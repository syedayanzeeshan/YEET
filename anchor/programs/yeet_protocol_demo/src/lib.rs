use anchor_lang::prelude::*;
use anchor_lang::AccountDeserialize;

declare_id!("4LPQkrcqQojofvWRnBBmucCnuJGSMzxqLJm8u98DNGEd");

/// Fixed stake factor when nodes do not register on-chain stake (permissionless claims).
pub const DEFAULT_STAKE_FACTOR: u32 = 50;

pub const EXECUTOR_ROLE_WEIGHT: u32 = 30;
pub const VALIDATOR_ROLE_WEIGHT: u32 = 20;
pub const CHALLENGER_ROLE_WEIGHT: u32 = 40;

pub const EXECUTION_POOL_BPS: u64 = 8000;
pub const CHALLENGER_POOL_BPS: u64 = 1500;
pub const RESERVED_BPS: u64 = 500;
pub const BPS_DENOMINATOR: u64 = 10_000;

pub const MAX_NAME_LEN: usize = 64;
pub const MAX_TASK_TYPE_LEN: usize = 32;

#[program]
pub mod yeet_protocol_demo {
    use super::*;

    pub fn create_task(
        ctx: Context<CreateTask>,
        task_id: u64,
        name: String,
        task_type: String,
        reward_pool: u64,
        redundancy_factor: u8,
        difficulty: u8,
        verification_threshold: u8,
        execution_timeout: u64,
    ) -> Result<()> {
        require!(name.len() > 0 && name.len() <= MAX_NAME_LEN, YeetError::InvalidName);
        require!(
            task_type.len() > 0 && task_type.len() <= MAX_TASK_TYPE_LEN,
            YeetError::InvalidTaskType
        );
        require!(reward_pool > 0, YeetError::EmptyRewardPool);
        require!(redundancy_factor >= 1, YeetError::RedundancyTooLow);
        require!(difficulty >= 1, YeetError::DifficultyTooLow);
        require!(
            verification_threshold > 0 && verification_threshold <= 100,
            YeetError::InvalidVerificationThreshold
        );

        let protocol = &mut ctx.accounts.protocol_state;
        if protocol.bump == 0 {
            protocol.bump = ctx.bumps.protocol_state;
        }
        require!(task_id == protocol.next_task_id, YeetError::InvalidTaskId);
        protocol.next_task_id = protocol
            .next_task_id
            .checked_add(1)
            .ok_or(YeetError::TaskIdOverflow)?;

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.requester.to_account_info(),
                    to: ctx.accounts.task_state.to_account_info(),
                },
            ),
            reward_pool,
        )?;

        let task = &mut ctx.accounts.task_state;
        task.task_id = task_id;
        task.requester = ctx.accounts.requester.key();
        task.name = name.clone();
        task.task_type = task_type.clone();
        task.reward_pool = reward_pool;
        task.redundancy_factor = redundancy_factor;
        task.difficulty = difficulty;
        task.verification_threshold = verification_threshold;
        task.execution_timeout = execution_timeout;
        task.state = TaskStatus::Open as u8;
        task.claim_count = 0;
        task.canonical_result = [0u8; 32];
        task.bump = ctx.bumps.task_state;

        emit!(TaskCreated {
            task_id,
            requester: task.requester,
            task_state: task.key(),
            name,
            task_type,
            reward_pool,
            redundancy_factor,
            difficulty,
            verification_threshold,
            execution_timeout,
        });

        Ok(())
    }

    pub fn submit_claim(
        ctx: Context<SubmitClaim>,
        role: u8,
        result_hash: [u8; 32],
        confidence: u8,
    ) -> Result<()> {
        require!(role <= 2, YeetError::InvalidRole);
        require!(confidence <= 100, YeetError::InvalidConfidence);

        let task = &mut ctx.accounts.task_state;
        require!(task.state == TaskStatus::Open as u8, YeetError::TaskNotOpen);

        let claim = &mut ctx.accounts.claim;
        claim.task_id = task.task_id;
        claim.node = ctx.accounts.node.key();
        claim.role = role;
        claim.result_hash = result_hash;
        claim.confidence = confidence;
        claim.bump = ctx.bumps.claim;

        task.claim_count = task
            .claim_count
            .checked_add(1)
            .ok_or(YeetError::ClaimCountOverflow)?;

        emit!(ClaimSubmitted {
            task_id: task.task_id,
            claim: claim.key(),
            node: claim.node,
            role,
            result_hash,
            confidence,
        });

        Ok(())
    }

    /// Permissionless resolution — pass every claim account for this task as remaining_accounts.
    pub fn resolve_task(ctx: Context<ResolveTask>) -> Result<()> {
        let task = &mut ctx.accounts.task_state;
        require!(task.state == TaskStatus::Open as u8, YeetError::TaskNotOpen);

        let min_claims = task.difficulty.max(1) as u32;
        require!(task.claim_count >= min_claims, YeetError::InsufficientClaims);

        let claim_infos = ctx.remaining_accounts;
        require!(
            claim_infos.len() as u32 >= task.claim_count,
            YeetError::MissingClaimAccounts
        );

        let mut parsed_claims: Vec<ClaimView> = Vec::new();

        for info in claim_infos.iter().take(task.claim_count as usize) {
            require!(info.owner == ctx.program_id, YeetError::InvalidClaimOwner);
            let data = info.try_borrow_data()?;
            let mut slice: &[u8] = &data;
            let claim = Claim::try_deserialize(&mut slice)?;
            require!(claim.task_id == task.task_id, YeetError::ClaimTaskMismatch);
            parsed_claims.push(ClaimView {
                node: claim.node,
                role: claim.role,
                result_hash: claim.result_hash,
                confidence: claim.confidence,
                weight: claim_weight(claim.role, claim.confidence),
            });
        }

        let canonical = pick_canonical_result(&parsed_claims)?;
        let task_key = task.key();
        let task_id = task.task_id;
        let verification_threshold = task.verification_threshold;
        let reward_pool = task.reward_pool;
        let claim_count = task.claim_count;

        task.canonical_result = canonical;
        task.state = TaskStatus::Resolved as u8;

        emit!(TaskResolved {
            task_id,
            task_state: task_key,
            canonical_result: canonical,
            claim_count,
        });

        let execution_pool = reward_pool
            .checked_mul(EXECUTION_POOL_BPS)
            .ok_or(YeetError::MathOverflow)?
            / BPS_DENOMINATOR;
        let challenger_pool = reward_pool
            .checked_mul(CHALLENGER_POOL_BPS)
            .ok_or(YeetError::MathOverflow)?
            / BPS_DENOMINATOR;

        let mut execution_weight_sum: u64 = 0;
        let mut challenger_weight_sum: u64 = 0;

        for claim in parsed_claims.iter() {
            let matches =
                claim.result_hash == canonical && claim.confidence >= verification_threshold;
            if !matches {
                let slashed = claim.confidence < verification_threshold
                    || claim.result_hash != canonical;
                if slashed {
                    emit!(SlashEvent {
                        task_id,
                        node: claim.node,
                        result_hash: claim.result_hash,
                        confidence: claim.confidence,
                        reason: if claim.confidence < verification_threshold {
                            0
                        } else {
                            1
                        },
                    });
                }
                continue;
            }

            if claim.role == Role::Challenger as u8 {
                challenger_weight_sum = challenger_weight_sum
                    .checked_add(claim.weight as u64)
                    .ok_or(YeetError::MathOverflow)?;
            } else {
                execution_weight_sum = execution_weight_sum
                    .checked_add(claim.weight as u64)
                    .ok_or(YeetError::MathOverflow)?;
            }
        }

        let task_info = ctx.accounts.task_state.to_account_info();

        for claim in parsed_claims.iter() {
            if claim.result_hash != canonical || claim.confidence < verification_threshold {
                continue;
            }

            let payout = if claim.role == Role::Challenger as u8 {
                if challenger_weight_sum == 0 {
                    0
                } else {
                    challenger_pool
                        .checked_mul(claim.weight as u64)
                        .ok_or(YeetError::MathOverflow)?
                        / challenger_weight_sum
                }
            } else if execution_weight_sum == 0 {
                0
            } else {
                execution_pool
                    .checked_mul(claim.weight as u64)
                    .ok_or(YeetError::MathOverflow)?
                    / execution_weight_sum
            };

            if payout == 0 {
                continue;
            }

            let node_info = ctx
                .remaining_accounts
                .iter()
                .find(|info| info.key() == claim.node);

            if let Some(node_account) = node_info {
                **task_info.try_borrow_mut_lamports()? -= payout;
                **node_account.try_borrow_mut_lamports()? += payout;

                emit!(RewardPaid {
                    task_id,
                    node: claim.node,
                    amount: payout,
                    role: claim.role,
                    result_hash: claim.result_hash,
                });
            }
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(task_id: u64)]
pub struct CreateTask<'info> {
    #[account(mut)]
    pub requester: Signer<'info>,
    #[account(
        init_if_needed,
        payer = requester,
        space = 8 + ProtocolState::INIT_SPACE,
        seeds = [b"protocol"],
        bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        init,
        payer = requester,
        space = 8 + TaskState::INIT_SPACE,
        seeds = [b"task", task_id.to_le_bytes().as_ref()],
        bump
    )]
    pub task_state: Account<'info, TaskState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitClaim<'info> {
    #[account(mut)]
    pub node: Signer<'info>,
    #[account(
        mut,
        seeds = [b"task", task_state.task_id.to_le_bytes().as_ref()],
        bump = task_state.bump
    )]
    pub task_state: Account<'info, TaskState>,
    #[account(
        init,
        payer = node,
        space = 8 + Claim::INIT_SPACE,
        seeds = [b"claim", task_state.task_id.to_le_bytes().as_ref(), node.key().as_ref()],
        bump
    )]
    pub claim: Account<'info, Claim>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveTask<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>,
    #[account(
        mut,
        seeds = [b"task", task_state.task_id.to_le_bytes().as_ref()],
        bump = task_state.bump
    )]
    pub task_state: Account<'info, TaskState>,
}

#[account]
#[derive(InitSpace)]
pub struct ProtocolState {
    pub next_task_id: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TaskState {
    pub task_id: u64,
    pub requester: Pubkey,
    #[max_len(MAX_NAME_LEN)]
    pub name: String,
    #[max_len(MAX_TASK_TYPE_LEN)]
    pub task_type: String,
    pub reward_pool: u64,
    pub redundancy_factor: u8,
    pub difficulty: u8,
    pub verification_threshold: u8,
    pub execution_timeout: u64,
    pub state: u8,
    pub claim_count: u32,
    pub canonical_result: [u8; 32],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Claim {
    pub task_id: u64,
    pub node: Pubkey,
    pub role: u8,
    pub result_hash: [u8; 32],
    pub confidence: u8,
    pub bump: u8,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum TaskStatus {
    Open = 0,
    Resolved = 1,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Executor = 0,
    Validator = 1,
    Challenger = 2,
}

struct ClaimView {
    node: Pubkey,
    role: u8,
    result_hash: [u8; 32],
    confidence: u8,
    weight: u32,
}

fn claim_weight(role: u8, confidence: u8) -> u32 {
    let role_weight = match role {
        x if x == Role::Executor as u8 => EXECUTOR_ROLE_WEIGHT,
        x if x == Role::Validator as u8 => VALIDATOR_ROLE_WEIGHT,
        x if x == Role::Challenger as u8 => CHALLENGER_ROLE_WEIGHT,
        _ => 0,
    };
    DEFAULT_STAKE_FACTOR
        .saturating_add(role_weight)
        .saturating_add(confidence as u32)
}

fn pick_canonical_result(claims: &[ClaimView]) -> Result<[u8; 32]> {
    require!(!claims.is_empty(), YeetError::NoClaims);

    let mut best_hash = claims[0].result_hash;
    let mut best_score: u64 = 0;

    for anchor in claims.iter() {
        let mut cluster_score: u64 = 0;
        for claim in claims.iter() {
            if claim.result_hash == anchor.result_hash {
                cluster_score = cluster_score
                    .checked_add(claim.weight as u64)
                    .ok_or(YeetError::MathOverflow)?;
            }
        }
        if cluster_score > best_score {
            best_score = cluster_score;
            best_hash = anchor.result_hash;
        }
    }

    Ok(best_hash)
}

#[event]
pub struct TaskCreated {
    pub task_id: u64,
    pub requester: Pubkey,
    pub task_state: Pubkey,
    pub name: String,
    pub task_type: String,
    pub reward_pool: u64,
    pub redundancy_factor: u8,
    pub difficulty: u8,
    pub verification_threshold: u8,
    pub execution_timeout: u64,
}

#[event]
pub struct ClaimSubmitted {
    pub task_id: u64,
    pub claim: Pubkey,
    pub node: Pubkey,
    pub role: u8,
    pub result_hash: [u8; 32],
    pub confidence: u8,
}

#[event]
pub struct TaskResolved {
    pub task_id: u64,
    pub task_state: Pubkey,
    pub canonical_result: [u8; 32],
    pub claim_count: u32,
}

#[event]
pub struct RewardPaid {
    pub task_id: u64,
    pub node: Pubkey,
    pub amount: u64,
    pub role: u8,
    pub result_hash: [u8; 32],
}

#[event]
pub struct SlashEvent {
    pub task_id: u64,
    pub node: Pubkey,
    pub result_hash: [u8; 32],
    pub confidence: u8,
    /// 0 = below threshold, 1 = losing hash
    pub reason: u8,
}

#[error_code]
pub enum YeetError {
    #[msg("Task name must be 1-64 characters.")]
    InvalidName,
    #[msg("Task type must be 1-32 characters.")]
    InvalidTaskType,
    #[msg("Reward pool must be greater than zero lamports.")]
    EmptyRewardPool,
    #[msg("Redundancy factor must be at least 1.")]
    RedundancyTooLow,
    #[msg("Difficulty (minimum claims) must be at least 1.")]
    DifficultyTooLow,
    #[msg("Verification threshold must be between 1 and 100.")]
    InvalidVerificationThreshold,
    #[msg("Task id does not match protocol counter.")]
    InvalidTaskId,
    #[msg("Task id counter overflow.")]
    TaskIdOverflow,
    #[msg("Invalid role — use 0 executor, 1 validator, 2 challenger.")]
    InvalidRole,
    #[msg("Confidence must be 0-100.")]
    InvalidConfidence,
    #[msg("Task is not open.")]
    TaskNotOpen,
    #[msg("Claim count overflow.")]
    ClaimCountOverflow,
    #[msg("Not enough claims submitted — difficulty sets the minimum.")]
    InsufficientClaims,
    #[msg("Pass all claim accounts for this task as remaining accounts.")]
    MissingClaimAccounts,
    #[msg("Claim account owner mismatch.")]
    InvalidClaimOwner,
    #[msg("Claim does not belong to this task.")]
    ClaimTaskMismatch,
    #[msg("No claims to resolve.")]
    NoClaims,
    #[msg("Math overflow.")]
    MathOverflow,
}
