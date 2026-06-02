use anchor_lang::prelude::*;
use anchor_lang::AccountDeserialize;

declare_id!("4LPQkrcqQojofvWRnBBmucCnuJGSMzxqLJm8u98DNGEd");

// ── Role weights ───────────────────────────────────────────────────────────────
pub const DEFAULT_STAKE_FACTOR: u32 = 50;
pub const EXECUTOR_ROLE_WEIGHT: u32 = 30;
pub const VALIDATOR_ROLE_WEIGHT: u32 = 20;
pub const CHALLENGER_ROLE_WEIGHT: u32 = 40;

// ── Reward pool splits (basis points) ─────────────────────────────────────────
pub const EXECUTION_POOL_BPS: u64 = 8000;
pub const CHALLENGER_POOL_BPS: u64 = 1500;
pub const RESERVED_BPS: u64 = 500;
pub const BPS_DENOMINATOR: u64 = 10_000;

// ── Challenger bond (0.005 SOL) – forfeited on losing claim ───────────────────
pub const CHALLENGE_BOND_LAMPORTS: u64 = 5_000_000;

// ── Reputation deltas ─────────────────────────────────────────────────────────
pub const REP_CORRECT: u16 = 5;
pub const REP_CHALLENGE_WIN_BONUS: u16 = 3;
pub const REP_SLASH: u16 = 10;
pub const REP_INITIAL: u16 = 72;

// ── Size caps ─────────────────────────────────────────────────────────────────
pub const MAX_NAME_LEN: usize = 64;
pub const MAX_TASK_TYPE_LEN: usize = 32;
pub const MAX_TASK_HISTORY: usize = 32;

#[program]
pub mod yeet_protocol_demo {
    use super::*;

    // ── NODE REGISTRY (merged from yeet_coordination) ─────────────────────────

    /// Register or update an operator's on-chain node profile.
    /// Idempotent — calling again updates hardware hash and role preference.
    pub fn register_node(
        ctx: Context<RegisterNode>,
        hardware_hash: [u8; 32],
        role_preference: u8,
    ) -> Result<()> {
        require!(role_preference <= 3, YeetError::InvalidRolePreference);

        let profile = &mut ctx.accounts.node_profile;
        let is_new = profile.operator == Pubkey::default();

        profile.operator = ctx.accounts.operator.key();
        profile.hardware_hash = hardware_hash;
        profile.role_preference = role_preference;
        profile.bump = ctx.bumps.node_profile;

        if is_new {
            profile.reputation_score = REP_INITIAL;
            profile.slash_count = 0;
            profile.challenge_wins = 0;
            profile.total_tasks = 0;
        }

        emit!(NodeRegistered {
            operator: profile.operator,
            node_profile: profile.key(),
            role_preference,
            reputation_score: profile.reputation_score,
        });

        Ok(())
    }

    // ── TASK LIFECYCLE ─────────────────────────────────────────────────────────

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

        // ── Update requester's persistent task history ─────────────────────
        let history = &mut ctx.accounts.task_history;
        if history.owner == Pubkey::default() {
            history.owner = ctx.accounts.requester.key();
            history.bump = ctx.bumps.task_history;
        }
        history.count = history.count.saturating_add(1);
        if history.recent_task_ids.len() >= MAX_TASK_HISTORY {
            history.recent_task_ids.remove(0);
        }
        history.recent_task_ids.push(task_id);

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

    /// Submit an execution claim for an open task.
    /// Challengers (role = 2) must bond CHALLENGE_BOND_LAMPORTS,
    /// which is returned on a winning challenge or forfeited on loss.
    pub fn submit_claim(
        ctx: Context<SubmitClaim>,
        role: u8,
        result_hash: [u8; 32],
        confidence: u8,
    ) -> Result<()> {
        require!(role <= 2, YeetError::InvalidRole);
        require!(confidence <= 100, YeetError::InvalidConfidence);
        // Check state before taking any mutable borrow so the CPI below compiles.
        require!(
            ctx.accounts.task_state.state == TaskStatus::Open as u8,
            YeetError::TaskNotOpen
        );

        // ── Challenger bond escrow ─────────────────────────────────────────
        // CPI must happen before `task` mutable borrow to satisfy the borrow checker.
        let challenge_bond: u64 = if role == Role::Challenger as u8 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.key(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.node.to_account_info(),
                        to: ctx.accounts.task_state.to_account_info(),
                    },
                ),
                CHALLENGE_BOND_LAMPORTS,
            )?;
            CHALLENGE_BOND_LAMPORTS
        } else {
            0
        };

        let task = &mut ctx.accounts.task_state;
        let claim = &mut ctx.accounts.claim;
        claim.task_id = task.task_id;
        claim.node = ctx.accounts.node.key();
        claim.role = role;
        claim.result_hash = result_hash;
        claim.confidence = confidence;
        claim.challenge_bond = challenge_bond;
        claim.reputation_settled = false;
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
            challenge_bond,
        });

        Ok(())
    }

    /// Permissionless resolution — pass every Claim PDA then every node wallet
    /// as remaining_accounts. Losing challenger bonds are redistributed to
    /// correct executors and validators.
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

        // ── Deserialize all claims ─────────────────────────────────────────
        let mut parsed: Vec<ClaimView> = Vec::new();
        for info in claim_infos.iter().take(task.claim_count as usize) {
            require!(info.owner == ctx.program_id, YeetError::InvalidClaimOwner);
            let data = info.try_borrow_data()?;
            let mut slice: &[u8] = &data;
            let claim = Claim::try_deserialize(&mut slice)?;
            require!(claim.task_id == task.task_id, YeetError::ClaimTaskMismatch);
            parsed.push(ClaimView {
                node: claim.node,
                role: claim.role,
                result_hash: claim.result_hash,
                confidence: claim.confidence,
                challenge_bond: claim.challenge_bond,
                weight: claim_weight(claim.role, claim.confidence),
            });
        }

        let canonical = pick_canonical_result(&parsed)?;
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

        // ── Pool accounting ────────────────────────────────────────────────
        let execution_pool_base = reward_pool
            .checked_mul(EXECUTION_POOL_BPS)
            .ok_or(YeetError::MathOverflow)?
            / BPS_DENOMINATOR;
        let challenger_pool = reward_pool
            .checked_mul(CHALLENGER_POOL_BPS)
            .ok_or(YeetError::MathOverflow)?
            / BPS_DENOMINATOR;

        // Losing challenger bonds are forfeited to the execution pool
        let forfeited_bonds: u64 = parsed
            .iter()
            .filter(|c| {
                c.role == Role::Challenger as u8
                    && (c.result_hash != canonical || c.confidence < verification_threshold)
            })
            .map(|c| c.challenge_bond)
            .fold(0u64, |acc, b| acc.saturating_add(b));

        let execution_pool = execution_pool_base.saturating_add(forfeited_bonds);

        // Accumulate weight sums for correct claimants
        let mut execution_weight_sum: u64 = 0;
        let mut challenger_weight_sum: u64 = 0;
        for claim in parsed.iter() {
            let correct =
                claim.result_hash == canonical && claim.confidence >= verification_threshold;
            if !correct {
                emit!(SlashEvent {
                    task_id,
                    node: claim.node,
                    result_hash: claim.result_hash,
                    confidence: claim.confidence,
                    forfeited_bond: claim.challenge_bond,
                    reason: if claim.confidence < verification_threshold { 0 } else { 1 },
                });
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

        // ── Pay winners ───────────────────────────────────────────────────
        let task_info = ctx.accounts.task_state.to_account_info();

        for claim in parsed.iter() {
            let correct =
                claim.result_hash == canonical && claim.confidence >= verification_threshold;
            if !correct {
                continue;
            }

            let pool_payout = if claim.role == Role::Challenger as u8 {
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

            // Bond is returned to winning challengers on top of their pool share
            let total_payout = if claim.role == Role::Challenger as u8 {
                pool_payout.saturating_add(claim.challenge_bond)
            } else {
                pool_payout
            };

            if total_payout == 0 {
                continue;
            }

            let node_info = claim_infos
                .iter()
                .find(|info| info.key() == claim.node);

            if let Some(node_account) = node_info {
                **task_info.try_borrow_mut_lamports()? -= total_payout;
                **node_account.try_borrow_mut_lamports()? += total_payout;

                emit!(RewardPaid {
                    task_id,
                    node: claim.node,
                    amount: total_payout,
                    role: claim.role,
                    result_hash: claim.result_hash,
                    bond_returned: claim.challenge_bond,
                });
            }
        }

        Ok(())
    }

    // ── REPUTATION SETTLEMENT ──────────────────────────────────────────────────

    /// Permissionless — anyone may call this after task resolution to settle
    /// on-chain reputation for a single registered node. Marks the claim
    /// as settled to prevent double-counting.
    pub fn update_node_reputation(ctx: Context<UpdateNodeReputation>) -> Result<()> {
        let task = &ctx.accounts.task_state;
        let claim = &mut ctx.accounts.claim;
        let profile = &mut ctx.accounts.node_profile;

        require!(
            task.state == TaskStatus::Resolved as u8,
            YeetError::TaskNotResolved
        );
        require!(!claim.reputation_settled, YeetError::ReputationAlreadySettled);

        let correct = claim.result_hash == task.canonical_result
            && claim.confidence >= task.verification_threshold;

        if correct {
            profile.reputation_score = profile
                .reputation_score
                .saturating_add(REP_CORRECT);
            if claim.role == Role::Challenger as u8 {
                profile.reputation_score = profile
                    .reputation_score
                    .saturating_add(REP_CHALLENGE_WIN_BONUS);
                profile.challenge_wins = profile.challenge_wins.saturating_add(1);
            }
        } else {
            profile.reputation_score = profile
                .reputation_score
                .saturating_sub(REP_SLASH);
            profile.slash_count = profile.slash_count.saturating_add(1);
        }
        profile.total_tasks = profile.total_tasks.saturating_add(1);
        claim.reputation_settled = true;

        emit!(ReputationUpdated {
            node: profile.operator,
            task_id: task.task_id,
            correct,
            new_reputation_score: profile.reputation_score,
            slash_count: profile.slash_count,
            challenge_wins: profile.challenge_wins,
            total_tasks: profile.total_tasks,
        });

        Ok(())
    }
}

// ── ACCOUNT CONTEXTS ──────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct RegisterNode<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(
        init_if_needed,
        payer = operator,
        space = 8 + NodeProfile::INIT_SPACE,
        seeds = [b"node", operator.key().as_ref()],
        bump
    )]
    pub node_profile: Account<'info, NodeProfile>,
    pub system_program: Program<'info, System>,
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
    #[account(
        init_if_needed,
        payer = requester,
        space = 8 + TaskHistory::INIT_SPACE,
        seeds = [b"history", requester.key().as_ref()],
        bump
    )]
    pub task_history: Account<'info, TaskHistory>,
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

#[derive(Accounts)]
pub struct UpdateNodeReputation<'info> {
    /// Anyone can trigger reputation settlement (permissionless).
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(
        seeds = [b"task", task_state.task_id.to_le_bytes().as_ref()],
        bump = task_state.bump
    )]
    pub task_state: Account<'info, TaskState>,
    #[account(
        mut,
        seeds = [b"claim", task_state.task_id.to_le_bytes().as_ref(), claim.node.as_ref()],
        bump = claim.bump,
        constraint = claim.task_id == task_state.task_id @ YeetError::ClaimTaskMismatch
    )]
    pub claim: Account<'info, Claim>,
    #[account(
        mut,
        seeds = [b"node", node_profile.operator.as_ref()],
        bump = node_profile.bump,
        constraint = node_profile.operator == claim.node @ YeetError::NodeProfileMismatch
    )]
    pub node_profile: Account<'info, NodeProfile>,
}

// ── ON-CHAIN ACCOUNT STRUCTS ──────────────────────────────────────────────────

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

/// Per-operator on-chain reputation profile (merged from yeet_coordination).
#[account]
#[derive(InitSpace)]
pub struct NodeProfile {
    pub operator: Pubkey,
    pub hardware_hash: [u8; 32],
    pub role_preference: u8,
    pub reputation_score: u16,
    pub slash_count: u16,
    pub challenge_wins: u16,
    pub total_tasks: u32,
    pub bump: u8,
}

/// Requester's persistent history — holds last MAX_TASK_HISTORY task IDs.
#[account]
#[derive(InitSpace)]
pub struct TaskHistory {
    pub owner: Pubkey,
    pub count: u32,
    #[max_len(MAX_TASK_HISTORY)]
    pub recent_task_ids: Vec<u64>,
    pub bump: u8,
}

/// A single node's execution claim for a task.
#[account]
#[derive(InitSpace)]
pub struct Claim {
    pub task_id: u64,
    pub node: Pubkey,
    pub role: u8,
    pub result_hash: [u8; 32],
    pub confidence: u8,
    /// Lamports bonded by a challenger; 0 for executors and validators.
    pub challenge_bond: u64,
    /// True once update_node_reputation has been called for this claim.
    pub reputation_settled: bool,
    pub bump: u8,
}

// ── INTERNAL TYPES ────────────────────────────────────────────────────────────

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
    challenge_bond: u64,
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

// ── EVENTS ────────────────────────────────────────────────────────────────────

#[event]
pub struct NodeRegistered {
    pub operator: Pubkey,
    pub node_profile: Pubkey,
    pub role_preference: u8,
    pub reputation_score: u16,
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
    pub challenge_bond: u64,
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
    pub bond_returned: u64,
}

#[event]
pub struct SlashEvent {
    pub task_id: u64,
    pub node: Pubkey,
    pub result_hash: [u8; 32],
    pub confidence: u8,
    pub forfeited_bond: u64,
    /// 0 = below confidence threshold, 1 = wrong result hash
    pub reason: u8,
}

#[event]
pub struct ReputationUpdated {
    pub node: Pubkey,
    pub task_id: u64,
    pub correct: bool,
    pub new_reputation_score: u16,
    pub slash_count: u16,
    pub challenge_wins: u16,
    pub total_tasks: u32,
}

// ── ERRORS ────────────────────────────────────────────────────────────────────

#[error_code]
pub enum YeetError {
    #[msg("Role preference must be executor (0), validator (1), challenger (2), or hybrid (3).")]
    InvalidRolePreference,
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
    #[msg("Task is not yet resolved.")]
    TaskNotResolved,
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
    #[msg("Node profile operator does not match claim node.")]
    NodeProfileMismatch,
    #[msg("Reputation already settled for this claim.")]
    ReputationAlreadySettled,
    #[msg("No claims to resolve.")]
    NoClaims,
    #[msg("Math overflow.")]
    MathOverflow,
}
