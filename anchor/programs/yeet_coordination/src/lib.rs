use anchor_lang::prelude::*;

declare_id!("8brd6wCKHMNXQwahfWrxzSdZpNsYU9JUnDCgpqJznnMP");

#[program]
pub mod yeet_coordination {
    use super::*;

    pub fn register_node(ctx: Context<RegisterNode>, hardware_hash: [u8; 32], role_preference: u8) -> Result<()> {
        require!(role_preference <= 3, YeetError::InvalidRolePreference);

        let node = &mut ctx.accounts.node_profile;
        node.operator = ctx.accounts.operator.key();
        node.hardware_hash = hardware_hash;
        node.role_preference = role_preference;
        node.reputation_score = 72;
        node.slash_count = 0;
        node.challenge_wins = 0;
        node.total_tasks = 0;
        node.bump = ctx.bumps.node_profile;

        emit!(NodeRegistered {
            operator: node.operator,
            node_profile: node.key(),
            role_preference,
            reputation_score: node.reputation_score,
        });

        Ok(())
    }

    pub fn open_task(
        ctx: Context<OpenTask>,
        task_nonce: u64,
        reward_pool: u64,
        redundancy: u8,
        verification_threshold: u8,
        coordinator: Pubkey,
        metadata_hash: [u8; 32],
    ) -> Result<()> {
        require!(reward_pool > 0, YeetError::EmptyRewardPool);
        require!(redundancy >= 2, YeetError::RedundancyTooLow);
        require!(
            verification_threshold > 0 && verification_threshold <= 100,
            YeetError::InvalidVerificationThreshold
        );

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.requester.to_account_info(),
                    to: ctx.accounts.task_escrow.to_account_info(),
                },
            ),
            reward_pool,
        )?;

        let task = &mut ctx.accounts.task_escrow;
        task.requester = ctx.accounts.requester.key();
        task.coordinator = coordinator;
        task.task_nonce = task_nonce;
        task.reward_pool = reward_pool;
        task.redundancy = redundancy;
        task.verification_threshold = verification_threshold;
        task.metadata_hash = metadata_hash;
        task.status = 0;
        task.opened_at = Clock::get()?.unix_timestamp;
        task.settled_at = 0;
        task.bump = ctx.bumps.task_escrow;

        emit!(TaskOpened {
            requester: task.requester,
            coordinator,
            task_escrow: task.key(),
            task_nonce,
            reward_pool,
            redundancy,
            verification_threshold,
            metadata_hash,
        });

        Ok(())
    }

    pub fn settle_task(
        ctx: Context<SettleTask>,
        verified_digest: [u8; 32],
        receipt_bundle_hash: [u8; 32],
        slash_amount: u64,
    ) -> Result<()> {
        let task = &mut ctx.accounts.task_escrow;
        let node = &mut ctx.accounts.node_profile;
        require!(task.status != 2, YeetError::TaskAlreadySettled);

        task.verified_digest = verified_digest;
        task.receipt_bundle_hash = receipt_bundle_hash;
        task.status = 2;
        task.settled_at = Clock::get()?.unix_timestamp;
        node.slash_count = node.slash_count.saturating_add(1);
        node.reputation_score = node.reputation_score.saturating_sub((slash_amount / 10) as u16);
        node.total_tasks = node.total_tasks.saturating_add(1);

        emit!(TaskSettled {
            coordinator: ctx.accounts.coordinator.key(),
            task_escrow: task.key(),
            slashed_node: node.key(),
            verified_digest,
            receipt_bundle_hash,
            slash_amount,
            new_reputation_score: node.reputation_score,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct RegisterNode<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(init, payer = operator, space = 8 + NodeProfile::INIT_SPACE, seeds = [b"node", operator.key().as_ref()], bump)]
    pub node_profile: Account<'info, NodeProfile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(task_nonce: u64)]
pub struct OpenTask<'info> {
    #[account(mut)]
    pub requester: Signer<'info>,
    #[account(
        init,
        payer = requester,
        space = 8 + TaskEscrow::INIT_SPACE,
        seeds = [b"task", requester.key().as_ref(), task_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub task_escrow: Account<'info, TaskEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleTask<'info> {
    pub coordinator: Signer<'info>,
    #[account(mut, has_one = coordinator)]
    pub task_escrow: Account<'info, TaskEscrow>,
    #[account(mut)]
    pub node_profile: Account<'info, NodeProfile>,
}

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

#[account]
#[derive(InitSpace)]
pub struct TaskEscrow {
    pub requester: Pubkey,
    pub coordinator: Pubkey,
    pub task_nonce: u64,
    pub reward_pool: u64,
    pub redundancy: u8,
    pub verification_threshold: u8,
    pub status: u8,
    pub metadata_hash: [u8; 32],
    pub verified_digest: [u8; 32],
    pub receipt_bundle_hash: [u8; 32],
    pub opened_at: i64,
    pub settled_at: i64,
    pub bump: u8,
}

#[event]
pub struct NodeRegistered {
    pub operator: Pubkey,
    pub node_profile: Pubkey,
    pub role_preference: u8,
    pub reputation_score: u16,
}

#[event]
pub struct TaskOpened {
    pub requester: Pubkey,
    pub coordinator: Pubkey,
    pub task_escrow: Pubkey,
    pub task_nonce: u64,
    pub reward_pool: u64,
    pub redundancy: u8,
    pub verification_threshold: u8,
    pub metadata_hash: [u8; 32],
}

#[event]
pub struct TaskSettled {
    pub coordinator: Pubkey,
    pub task_escrow: Pubkey,
    pub slashed_node: Pubkey,
    pub verified_digest: [u8; 32],
    pub receipt_bundle_hash: [u8; 32],
    pub slash_amount: u64,
    pub new_reputation_score: u16,
}

#[error_code]
pub enum YeetError {
    #[msg("Role preference must be executor, validator, challenger, or hybrid.")]
    InvalidRolePreference,
    #[msg("Reward pool must be greater than zero lamports.")]
    EmptyRewardPool,
    #[msg("Redundancy must be at least two nodes.")]
    RedundancyTooLow,
    #[msg("Verification threshold must be between 1 and 100.")]
    InvalidVerificationThreshold,
    #[msg("Task is already settled.")]
    TaskAlreadySettled,
}
