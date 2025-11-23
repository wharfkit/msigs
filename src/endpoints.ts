import {APIClient, Int32, Name, NameType, UInt64, UInt64Type} from '@wharfkit/antelope'
import type {
    GetActiveResponse,
    GetActivityResponse,
    GetApprovalsResponse,
    GetApproverProposalsResponse,
    GetProposalHistoryResponse,
    GetProposalResponse,
    GetProposalsResponse,
    GetStatusResponse,
    SearchProposalsResponse,
} from './types'

interface GetProposalOptions {
    globalseq?: UInt64Type
    version_history?: boolean
}

interface GetProposalHistoryOptions {
    status?: string
    limit?: number
    offset?: number
}

interface GetProposalsOptions {
    proposer?: NameType
    status?: string
    limit?: number
    offset?: number
}

interface GetActiveOptions {
    limit?: number
    offset?: number
    sort_by?: string
}

interface GetApprovalsOptions {
    globalseq?: UInt64Type
    limit?: number
    offset?: number
}

interface GetActivityOptions {
    limit?: number
    offset?: number
    action_type?: string
}

interface GetApproverProposalsOptions {
    status?: string
    include_approved?: boolean
    limit?: number
    offset?: number
}

interface SearchProposalsOptions {
    status?: string
    limit?: number
    offset?: number
}

export interface MsigsClientOptions {
    maxProposalLimit?: number
    maxApprovalLimit?: number
}

export class MsigsClient {
    private maxProposalLimit?: number
    private maxApprovalLimit?: number
    private limitsInitialized = false

    constructor(private client: APIClient, private options?: MsigsClientOptions) {
        this.maxProposalLimit = options ? options.maxProposalLimit : undefined
        this.maxApprovalLimit = options ? options.maxApprovalLimit : undefined
    }

    private async initializeLimits() {
        if (this.limitsInitialized) {
            return
        }

        if (this.maxProposalLimit !== undefined && this.maxApprovalLimit !== undefined) {
            this.limitsInitialized = true
            return
        }

        try {
            const status = await this.get_status()
            if (this.maxProposalLimit === undefined) {
                this.maxProposalLimit = status.max_proposal_results || 20
            }
            if (this.maxApprovalLimit === undefined) {
                this.maxApprovalLimit = status.max_approval_results || 100
            }
            this.limitsInitialized = true
        } catch (error) {
            if (this.maxProposalLimit === undefined) {
                this.maxProposalLimit = 20
            }
            if (this.maxApprovalLimit === undefined) {
                this.maxApprovalLimit = 100
            }
            this.limitsInitialized = true
        }
    }

    async getMaxProposalLimit(): Promise<number> {
        await this.initializeLimits()
        return this.maxProposalLimit!
    }

    async getMaxApprovalLimit(): Promise<number> {
        await this.initializeLimits()
        return this.maxApprovalLimit!
    }

    async get_proposal(proposer: NameType, proposalName: NameType, options?: GetProposalOptions) {
        const params: Record<string, any> = {
            proposer: Name.from(proposer),
            proposal_name: Name.from(proposalName),
        }

        if (options && options.globalseq !== undefined) {
            params['globalseq'] = UInt64.from(options.globalseq)
        }

        if (options && options.version_history !== undefined) {
            params['version_history'] = options.version_history
        }

        return this.client.call({
            path: '/v1/proposals/get_proposal',
            params,
        }) as Promise<GetProposalResponse>
    }

    async get_proposal_history(
        proposer: NameType,
        proposalName: NameType,
        options?: GetProposalHistoryOptions
    ) {
        const params: Record<string, any> = {
            proposer: Name.from(proposer),
            proposal_name: Name.from(proposalName),
        }

        if (options && options.status !== undefined) {
            params['status'] = options.status
        }

        if (options && options.limit !== undefined) {
            await this.initializeLimits()
            if (options.limit > this.maxProposalLimit!) {
                throw new Error(`Limit cannot exceed ${this.maxProposalLimit}`)
            }
            params['limit'] = Int32.from(options.limit)
        }

        if (options && options.offset !== undefined) {
            params['offset'] = Int32.from(options.offset)
        }

        return this.client.call({
            path: '/v1/proposals/get_proposal_history',
            params,
        }) as Promise<GetProposalHistoryResponse>
    }

    async get_proposals(options?: GetProposalsOptions) {
        const params: Record<string, any> = {}

        if (options && options.proposer !== undefined) {
            params['proposer'] = Name.from(options.proposer)
        }

        if (options && options.status !== undefined) {
            params['status'] = options.status
        }

        if (options && options.limit !== undefined) {
            await this.initializeLimits()
            if (options.limit > this.maxProposalLimit!) {
                throw new Error(`Limit cannot exceed ${this.maxProposalLimit}`)
            }
            params['limit'] = Int32.from(options.limit)
        }

        if (options && options.offset !== undefined) {
            params['offset'] = Int32.from(options.offset)
        }

        return this.client.call({
            path: '/v1/proposals/get_proposals',
            params,
        }) as Promise<GetProposalsResponse>
    }

    async get_active(options?: GetActiveOptions) {
        const params: Record<string, any> = {}

        if (options && options.limit !== undefined) {
            await this.initializeLimits()
            if (options.limit > this.maxProposalLimit!) {
                throw new Error(`Limit cannot exceed ${this.maxProposalLimit}`)
            }
            params['limit'] = Int32.from(options.limit)
        }

        if (options && options.offset !== undefined) {
            params['offset'] = Int32.from(options.offset)
        }

        if (options && options.sort_by !== undefined) {
            params['sort_by'] = options.sort_by
        }

        return this.client.call({
            path: '/v1/proposals/get_active',
            params,
        }) as Promise<GetActiveResponse>
    }

    async get_approvals(proposer: NameType, proposalName: NameType, options?: GetApprovalsOptions) {
        const params: Record<string, any> = {
            proposer: Name.from(proposer),
            proposal_name: Name.from(proposalName),
        }

        if (options && options.globalseq !== undefined) {
            params['globalseq'] = UInt64.from(options.globalseq)
        }

        if (options && options.limit !== undefined) {
            await this.initializeLimits()
            if (options.limit > this.maxApprovalLimit!) {
                throw new Error(`Limit cannot exceed ${this.maxApprovalLimit}`)
            }
            params['limit'] = Int32.from(options.limit)
        }

        if (options && options.offset !== undefined) {
            params['offset'] = Int32.from(options.offset)
        }

        return this.client.call({
            path: '/v1/proposals/get_approvals',
            params,
        }) as Promise<GetApprovalsResponse>
    }

    async get_activity(account: NameType, options?: GetActivityOptions) {
        const params: Record<string, any> = {
            account: Name.from(account),
        }

        if (options && options.limit !== undefined) {
            await this.initializeLimits()
            if (options.limit > this.maxProposalLimit!) {
                throw new Error(`Limit cannot exceed ${this.maxProposalLimit}`)
            }
            params['limit'] = Int32.from(options.limit)
        }

        if (options && options.offset !== undefined) {
            params['offset'] = Int32.from(options.offset)
        }

        if (options && options.action_type !== undefined) {
            params['action_type'] = options.action_type
        }

        return this.client.call({
            path: '/v1/proposals/get_activity',
            params,
        }) as Promise<GetActivityResponse>
    }

    async get_approver_proposals(approver: NameType, options?: GetApproverProposalsOptions) {
        const params: Record<string, any> = {
            approver: Name.from(approver),
        }

        if (options && options.status !== undefined) {
            params['status'] = options.status
        }

        if (options && options.include_approved !== undefined) {
            params['include_approved'] = options.include_approved
        }

        if (options && options.limit !== undefined) {
            await this.initializeLimits()
            if (options.limit > this.maxProposalLimit!) {
                throw new Error(`Limit cannot exceed ${this.maxProposalLimit}`)
            }
            params['limit'] = Int32.from(options.limit)
        }

        if (options && options.offset !== undefined) {
            params['offset'] = Int32.from(options.offset)
        }

        return this.client.call({
            path: '/v1/proposals/get_approver_proposals',
            params,
        }) as Promise<GetApproverProposalsResponse>
    }

    async search_proposals(query: string, options?: SearchProposalsOptions) {
        const params: Record<string, any> = {
            query,
        }

        if (options && options.status !== undefined) {
            params['status'] = options.status
        }

        if (options && options.limit !== undefined) {
            await this.initializeLimits()
            if (options.limit > this.maxProposalLimit!) {
                throw new Error(`Limit cannot exceed ${this.maxProposalLimit}`)
            }
            params['limit'] = Int32.from(options.limit)
        }

        if (options && options.offset !== undefined) {
            params['offset'] = Int32.from(options.offset)
        }

        return this.client.call({
            path: '/v1/proposals/search_proposals',
            params,
        }) as Promise<SearchProposalsResponse>
    }

    async get_status() {
        return this.client.call({
            path: '/v1/proposals/get_status',
            params: {},
        }) as Promise<GetStatusResponse>
    }
}

export interface PaginationInfo {
    currentPage: number
    pageSize: number
    totalResults: number
    totalPages: number
    hasMore: boolean
    hasPrevious: boolean
    nextOffset?: number
    previousOffset?: number
}

export function getPaginationInfo(
    offset: number,
    limit: number,
    total: number,
    more: boolean
): PaginationInfo {
    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = Math.ceil(total / limit)
    const hasMore = more
    const hasPrevious = offset > 0

    return {
        currentPage,
        pageSize: limit,
        totalResults: total,
        totalPages,
        hasMore,
        hasPrevious,
        nextOffset: hasMore ? offset + limit : undefined,
        previousOffset: hasPrevious ? Math.max(0, offset - limit) : undefined,
    }
}
