use anchor_lang::prelude::*;

declare_id!("Yeet111111111111111111111111111111111111111");

#[program]
pub mod yeet_coordination {
    use super::*;

    pub fn register_node(ctx: Context<RegisterNode>, hardware_hash: [u8; 32], role_preference: u8) -> Result<()> {
        let node = &mut ctx.accounts.node_profile;
        node.operator = ctx.accounts.operator.key();
        node.hardware_hash = hardware_hash;
        node.role_preference = role_preference;
        node.reputation_score = 72;
        node.slash_count = 0;
        node.challenge_wins = 0;
        Ok(())
    }

    pub fn open_task(ctx: Context<OpenTask>, reward_pool: u64, redundancy: u8, verification_threshold: u8) -> Result<()> {
        let task = &mut ctx.accounts.task_escrow;
        task.requester = ctx.accounts.requester.key();
        task.reward_pool = reward_pool;
        task.redundancy = redundancy;
        task.verification_threshold = verification_threshold;
        task.status = 0;
        Ok(())
    }

    pub fn settle_task(ctx: Context<SettleTask>, verified_digest: [u8; 32], slash_amount: u64) -> Result<()> {
        let task = &mut ctx.accounts.task_escrow;
        let node = &mut ctx.accounts.node_profile;
        task.verified_digest = verified_digest;
        task.status = 2;
        node.slash_count = node.slash_count.saturating_add(1);
        node.reputation_score = node.reputation_score.saturating_sub((slash_amount / 10) as u16);
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
pub struct OpenTask<'info> {
    #[account(mut)]
    pub requester: Signer<'info>,
    #[account(init, payer = requester, space = 8 + TaskEscrow::INIT_SPACE, seeds = [b"task", requester.key().as_ref()], bump)]
    pub task_escrow: Account<'info, TaskEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleTask<'info> {
    pub coordinator: Signer<'info>,
    #[account(mut)]
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
}

#[account]
#[derive(InitSpace)]
pub struct TaskEscrow {
    pub requester: Pubkey,
    pub reward_pool: u64,
    pub redundancy: u8,
    pub verification_threshold: u8,
    pub status: u8,
    pub verified_digest: [u8; 32],
}
