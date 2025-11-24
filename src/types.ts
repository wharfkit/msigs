import {Checksum256, Name, TimePoint} from '@wharfkit/antelope'

export interface PermissionLevel {
    actor: Name | string
    permission: Name | string
}

export type ProposalStatus = 'proposed' | 'executed' | 'cancelled' | 'expired'

export type ActivityAction = 'proposed' | 'approved' | 'unapproved' | 'executed' | 'cancelled'

export interface Transaction {
    expiration: string | TimePoint
    ref_block_num: number
    ref_block_prefix: number
    max_net_usage_words: number
    max_cpu_usage_ms: number
    delay_sec: number
    context_free_actions: any[]
    actions: any[]
    transaction_extensions: any[]
}

export interface Proposal {
    proposer: Name | string
    proposal_name: Name | string
    status: ProposalStatus
    created_at: string | TimePoint
    created_block: number
    created_trx_id: Checksum256 | string
    globalseq: number
    expiration: string | TimePoint
    actions_count: number
    requested_approvals?: PermissionLevel[]
    provided_approvals?: PermissionLevel[]
    // Summary fields (present in list endpoints, absent in detail endpoint)
    approvals_required?: number
    approvals_received?: number
    approval_ratio?: number
    time_remaining_seconds?: number
    transaction?: Transaction
    executed_at?: string | TimePoint | null
    executed_by?: Name | string | null
    executed_trx_id?: Checksum256 | string | null
    cancelled_at?: string | TimePoint | null
    cancelled_by?: Name | string | null
    cancelled_trx_id?: Checksum256 | string | null
}

export interface ProposalVersion {
    globalseq: number
    status: ProposalStatus
    timestamp: string | TimePoint
    block_num: number
    trx_id: Checksum256 | string
    proposal: Proposal
}

export interface ApprovalEvent {
    action: 'approve' | 'unapprove' | 'invalidate'
    actor: Name | string
    permission: Name | string
    timestamp: string | TimePoint
    block_num: number
    globalseq: number
}

export interface ActivityEvent {
    action: ActivityAction
    timestamp: string | TimePoint
    proposer: Name | string
    proposal_name: Name | string
    globalseq: number
}

export interface ServiceStatus {
    head_block_num?: number
    last_irreversible_block_num?: number
    chain_id?: string
    server_version?: string
    accepting_http?: boolean
    database_size?: number
    database_size_mb?: number
    last_account_action_seq?: number
    synced?: boolean
    max_proposal_results?: number
    max_approval_results?: number
}
export interface GetProposalResponse extends Proposal {
    version_history?: ProposalVersion[]
}

export interface GetProposalHistoryResponse {
    proposer: Name | string
    proposal_name: Name | string
    versions: ProposalVersion[]
    more: boolean
    total: number
}

export interface GetProposalsResponse {
    proposals: Proposal[]
    more: boolean
    total: number
}

export interface GetApprovalsResponse {
    proposer: Name | string
    proposal_name: Name | string
    globalseq: number
    timeline: ApprovalEvent[]
    total: number
    more: boolean
}

export interface GetActivityResponse {
    account: Name | string
    activity: ActivityEvent[]
    more: boolean
    total: number
}

export interface GetApproverProposalsResponse {
    approver: Name | string
    proposals: Proposal[]
    more: boolean
    total: number
}

export interface SearchProposalsResponse {
    query: string
    status?: string
    proposals: Proposal[]
    more: boolean
    total: number
}

export type GetStatusResponse = ServiceStatus

export interface DebugProposalResponse {
    proposer: Name | string
    proposal_name: Name | string
    globalseq: number
    actions_count: number
    stored_status_byte: number
    stored_status_string: ProposalStatus
    computed_status_byte: number
    computed_status_string: ProposalStatus
    status_changed: boolean
    stored_proposed_at: number
    stored_executed_at: number
    stored_cancelled_at: number
    stored_expiration_unix: number
    stored_expiration_iso: string | TimePoint
    current_time_unix: number
    current_time_iso: string | TimePoint
    is_expiration_past: boolean
    time_until_expiration: number
    approvals_requested: number
    approvals_provided: number
}
