# @wharfkit/msigs

API client for the Roborovski Multisig Proposals API.

## Installing

```
yarn add @wharfkit/msigs
```

## Usage

```typescript
import {APIClient} from '@wharfkit/antelope'
import {MsigsClient} from '@wharfkit/msigs'

// Create an API client pointing to your msigs service
const client = new APIClient({url: 'https://your-msigs-service.com'})

// Create a Msigs client
const msigs = new MsigsClient(client)

// Get service status (Optional)
const status = await msigs.get_status()
console.log('Service limits:', {
    max_proposal_results: status.max_proposal_results, // 20
    max_approval_results: status.max_approval_results, // 100
})

// Get a specific proposal
const proposal = await msigs.get_proposal('alice', 'upgrade')
console.log('Proposal:', {
    proposer: proposal.proposer, // 'alice'
    proposal_name: proposal.proposal_name, // 'upgrade'
    status: proposal.status, // 'proposed'
    actions_count: proposal.actions_count, // 1
})

// Get proposals requiring my approval
const myProposals = await msigs.get_approver_proposals('bob', {
    status: 'proposed',
    include_approved: false, // Only show proposals I haven't approved yet
})
console.log(`${myProposals.total} proposals need my approval`)

// Get account activity
const activity = await msigs.get_activity('alice', {
    action_type: 'proposed',
    limit: 20,
})
console.log(`Alice has proposed ${activity.total} transactions`)
```

## Pagination

All list endpoints (`get_proposals`, `get_activity`, `get_approver_proposals`, `get_proposal_history`) support pagination with standard response fields:

-   `total`: Total number of results available
-   `more`: Boolean indicating if more pages exist
-   `offset`: Current offset parameter for navigation

### Basic Pagination Example

```typescript
import {MsigsClient, getPaginationInfo} from '@wharfkit/msigs'

// Get first page
let offset = 0
const limit = 10
const firstPage = await msigs.get_proposals('alice', {limit, offset})

console.log(`Total proposals: ${firstPage.total}`)
console.log(`More pages: ${firstPage.more}`)
console.log(`Results: ${firstPage.proposals.length}`)

// Get pagination info
const pageInfo = getPaginationInfo(offset, limit, firstPage.total, firstPage.more)
console.log(`Page ${pageInfo.currentPage} of ${pageInfo.totalPages}`)

// Get next page if available
if (pageInfo.hasMore) {
    const nextPage = await msigs.get_proposals('alice', {
        limit,
        offset: pageInfo.nextOffset,
    })
}
```

### Load All Pages Example

```typescript
async function getAllProposals(msigs: MsigsClient, proposer: string) {
    const allProposals = []
    let offset = 0
    const limit = 20 // Use max limit for efficiency

    do {
        const response = await msigs.get_proposals(proposer, {limit, offset})
        allProposals.push(...response.proposals)

        if (!response.more) {
            break
        }
        offset += limit
    } while (true)

    return allProposals
}
```

### Service Limits

The service enforces different maximum results per endpoint:

-   **Proposals** (get_proposals, get_approver_proposals, etc.): Default 20 results max
-   **Approvals** (get_approvals): Default 100 results max

Check current limits via `get_status()`:

```typescript
const status = await msigs.get_status()
console.log(`Max proposal results: ${status.max_proposal_results}`)
console.log(`Max approval results: ${status.max_approval_results}`)

// The SDK automatically fetches and enforces these limits
const maxLimit = await msigs.getMaxProposalLimit()
```

## API Methods

### `get_status()`

Get service status and sync information, including configured service limits.

**Returns:** Status object with chain sync info, head block, service metadata, and pagination limits (`max_proposal_results`, `max_approval_results`).

---

### `get_proposal(proposer, proposalName, options?)`

Get a single proposal by proposer and proposal name.

**Parameters:**

-   `proposer: string` - The account that proposed the transaction
-   `proposalName: string` - The name of the proposal
-   `options.globalseq?: number` - Get specific version by global sequence number
-   `options.version_history?: boolean` - Include version history (default: true)

**Returns:** Full proposal details including metadata, approvals, and transaction data.

---

### `get_proposal_history(proposer, proposalName, options?)`

Get version history for a proposal.

**Parameters:**

-   `proposer: string` - The account that proposed the transaction
-   `proposalName: string` - The name of the proposal
-   `options.status?: string` - Filter by status: 'proposed', 'executed', 'cancelled', 'expired', 'all'
-   `options.limit?: number` - Maximum results to return (max: 100)
-   `options.offset?: number` - Pagination offset

**Returns:** Paginated list of proposal versions.

---

### `get_proposals(proposer, options?)`

List proposals for a specific proposer account.

**Parameters:**

-   `proposer: string` - The proposer account to filter by (required)

**Options:**

-   `status?: string` - Filter by status: 'proposed', 'executed', 'cancelled', 'expired', 'all'
-   `limit?: number` - Maximum results to return
-   `offset?: number` - Pagination offset

**Returns:** Paginated list of proposals matching the filters with `total` and `more` fields.

---

### `get_approvals(proposer, proposalName)`

Get approval timeline for a proposal.

**Parameters:**

-   `proposer: string` - The account that proposed the transaction
-   `proposalName: string` - The name of the proposal

**Returns:** Timeline of approval/unapproval events with timestamps and block info.

---

### `get_activity(account, options?)`

Get account activity (proposed/approved/unapproved/executed/cancelled actions).

**Parameters:**

-   `account: string` - The account to get activity for
-   `options.limit?: number` - Maximum results to return
-   `options.offset?: number` - Pagination offset
-   `options.action_type?: string` - Filter by action type: 'proposed', 'approved', 'unapproved', 'executed', 'cancelled', 'all'

**Returns:** Paginated list of multisig actions involving the account with `total` and `more` fields.

---

### `get_approver_proposals(approver, options?)`

Get proposals requiring approval from a specific account.

**Parameters:**

-   `approver: string` - The account that needs to approve
-   `options.status?: string` - Filter by status: 'proposed', 'executed', 'cancelled', 'expired', 'all'
-   `options.include_approved?: boolean` - Include proposals already approved by this account
-   `options.limit?: number` - Maximum results to return
-   `options.offset?: number` - Pagination offset

**Returns:** Paginated list of proposals requiring approval from the specified account with `total` and `more` fields.

---

### `debug_proposal(proposer, proposalName, options?)`

Debug proposal status computation (for troubleshooting status discrepancies).

**Parameters:**

-   `proposer: string` - The account that proposed the transaction
-   `proposalName: string` - The name of the proposal
-   `options.globalseq?: number` - Debug specific version by global sequence number

**Returns:** Detailed debug information including stored status byte, computed status, expiration checks, approval counts, and debug notes explaining status computation.

---

## Development

Build the library:

```
make
```

Format code:

```
make format
```

Check for linting errors:

```
make check
```
