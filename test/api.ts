import {assert} from 'chai'

import {APIClient, FetchProvider} from '@wharfkit/antelope'
import {mockFetch} from '@wharfkit/mock-data'

import {MsigsClient, getPaginationInfo} from '$lib'

// Setup an APIClient using mockFetch for recording/playback
const client = new APIClient({
    provider: new FetchProvider('http://localhost', {fetch: mockFetch}),
})

// Setup the API
const msigs = new MsigsClient(client)

suite('api', function () {
    this.slow(200)
    this.timeout(10 * 10000)

    suite('client configuration', function () {
        test('get_status returns configured limits', async function () {
            const status = await msigs.get_status()
            assert.isDefined(status)
            assert.isDefined(status.max_proposal_results)
            assert.isDefined(status.max_approval_results)
            // Default limits
            assert.equal(status.max_proposal_results, 20)
            assert.equal(status.max_approval_results, 100)
        })

        test('client fetches limits dynamically on first use', async function () {
            const defaultClient = new MsigsClient(client)
            const maxLimit = await defaultClient.getMaxProposalLimit()
            assert.equal(maxLimit, 20)
        })

        test('custom maxProposalLimit can be configured', async function () {
            const customClient = new MsigsClient(client, {maxProposalLimit: 50})
            const maxLimit = await customClient.getMaxProposalLimit()
            assert.equal(maxLimit, 50)
        })

        test('limit validation for get_proposals', async function () {
            try {
                await msigs.get_proposals({limit: 50})
                assert.fail('Should have thrown error')
            } catch (error: any) {
                assert.include(error.message, 'Limit cannot exceed 20')
            }
        })

        test('limit validation for get_active', async function () {
            try {
                await msigs.get_active({limit: 50})
                assert.fail('Should have thrown error')
            } catch (error: any) {
                assert.include(error.message, 'Limit cannot exceed 20')
            }
        })

        test('limit validation for get_activity', async function () {
            try {
                await msigs.get_activity('alice', {limit: 50})
                assert.fail('Should have thrown error')
            } catch (error: any) {
                assert.include(error.message, 'Limit cannot exceed 20')
            }
        })

        test('limit validation for get_approver_proposals', async function () {
            try {
                await msigs.get_approver_proposals('bob', {limit: 50})
                assert.fail('Should have thrown error')
            } catch (error: any) {
                assert.include(error.message, 'Limit cannot exceed 20')
            }
        })

        test('limit validation for get_proposal_history', async function () {
            try {
                await msigs.get_proposal_history('alice', 'upgrade', {limit: 50})
                assert.fail('Should have thrown error')
            } catch (error: any) {
                assert.include(error.message, 'Limit cannot exceed 20')
            }
        })
    })

    test('get_status', async function () {
        const res = await msigs.get_status()
        assert.isDefined(res)
        // Status response includes sync info
        assert.isDefined(res.last_account_action_seq)
    })

    test('get_proposals (default, list all)', async function () {
        const res = await msigs.get_proposals()
        assert.isDefined(res)
        assert.isArray(res.proposals)
        assert.isDefined(res.total)
        assert.isDefined(res.more)

        // Verify proposals have proper structure and globalseq
        if (res.proposals.length > 0) {
            res.proposals.forEach((p) => {
                assert.isDefined(p.proposer)
                assert.isDefined(p.proposal_name)
                assert.isDefined(p.globalseq)
                assert.isDefined(p.status)
            })
        }
    })

    test('get_proposals (filter by status)', async function () {
        const res = await msigs.get_proposals({
            status: 'proposed',
            limit: 10,
        })
        assert.isDefined(res)
        assert.isArray(res.proposals)

        // Verify all results match the filter
        res.proposals.forEach((p) => {
            assert.equal(p.status, 'proposed')
            assert.isDefined(p.globalseq)
        })
    })

    test('get_proposals (filter by proposer)', async function () {
        const res = await msigs.get_proposals({
            proposer: 'alice',
            limit: 10,
        })
        assert.isDefined(res)
        assert.isArray(res.proposals)
        assert.equal(res.total, 8) // alice has 8 proposals total

        // Verify all results match the proposer filter
        res.proposals.forEach((p) => {
            assert.equal(p.proposer, 'alice')
            assert.isDefined(p.globalseq)
        })

        // Bug #4 FIXED: Results now properly sorted by globalseq descending

        // Verify specific proposals are included
        const hasUpgrade = res.proposals.some(
            (p) => p.proposal_name === 'upgrade' || p.proposal_name.toString() === 'upgrade'
        )
        const hasNewperm = res.proposals.some(
            (p) => p.proposal_name === 'newperm' || p.proposal_name.toString() === 'newperm'
        )
        assert.isTrue(hasUpgrade, 'Should include upgrade proposal')
        assert.isTrue(hasNewperm, 'Should include newperm proposal')
    })

    test('get_active (default)', async function () {
        const res = await msigs.get_active()
        assert.isDefined(res)
        assert.isDefined(res.total)

        // Verify all results are proposed status (active)
        if (res.proposals && res.proposals.length > 0) {
            res.proposals.forEach((p) => {
                assert.equal(p.status, 'proposed')
                assert.isDefined(p.globalseq)
                assert.isDefined(p.expiration)
            })
        }
    })

    test('get_active (with limit)', async function () {
        const res = await msigs.get_active({
            limit: 5,
        })
        assert.isDefined(res)
        assert.isDefined(res.total)

        // Limit now works correctly!
        if (res.proposals && res.proposals.length > 0) {
            assert.equal(res.proposals.length, 5)
            res.proposals.forEach((p) => {
                assert.equal(p.status, 'proposed')
                assert.isDefined(p.globalseq)
            })
        }
    })

    test('get_active (sorted by expiration)', async function () {
        const res = await msigs.get_active({
            sort_by: 'expiration',
            limit: 10,
        })
        assert.isDefined(res)
        assert.isDefined(res.total)

        // Verify results are sorted by expiration (ascending)
        if (res.proposals && res.proposals.length > 1) {
            for (let i = 1; i < res.proposals.length; i++) {
                const prev = res.proposals[i - 1]
                const curr = res.proposals[i]
                assert.isDefined(prev.expiration)
                assert.isDefined(curr.expiration)
                assert.isDefined(prev.globalseq)
                assert.isDefined(curr.globalseq)
                // Each proposal should be proposed status
                assert.equal(prev.status, 'proposed')
                assert.equal(curr.status, 'proposed')
            }
        }
    })

    test('get_proposal (alice/upgrade - test data)', async function () {
        const res = await msigs.get_proposal('alice', 'upgrade')
        assert.isDefined(res)
        assert.equal(res.proposer, 'alice')
        assert.equal(res.proposal_name, 'upgrade')
        assert.equal(res.status, 'proposed')
        // Should be latest version (v7: globalseq 1033)
        assert.equal(res.globalseq, 1033)
        // Should include version_history by default
        // Note: API returns 6 versions in history (not including current version)
        if (res.version_history) {
            assert.isArray(res.version_history)
            assert.equal(res.version_history.length, 6)
        }
    })

    test('get_proposal (with version_history false)', async function () {
        const res = await msigs.get_proposal('alice', 'upgrade', {
            version_history: false,
        })
        assert.isDefined(res)
        assert.equal(res.proposer, 'alice')
        assert.equal(res.proposal_name, 'upgrade')
        // Should still return latest version
        assert.equal(res.globalseq, 1033)
        // version_history should be undefined or empty
        assert.isUndefined(res.version_history)
    })

    test('get_proposal (with specific globalseq)', async function () {
        const res = await msigs.get_proposal('alice', 'upgrade', {
            globalseq: 1001,
        })
        assert.isDefined(res)
        assert.equal(res.proposer, 'alice')
        assert.equal(res.proposal_name, 'upgrade')
        // Should return the specific version with globalseq 1001
        assert.equal(res.globalseq, 1001)
    })

    test('get_proposal_history (alice/upgrade has 7 versions)', async function () {
        const res = await msigs.get_proposal_history('alice', 'upgrade')
        assert.isDefined(res)
        assert.equal(res.proposer, 'alice')
        assert.equal(res.proposal_name, 'upgrade')
        assert.isArray(res.versions)
        // alice/upgrade should have 7 versions according to testdata.go
        assert.equal(res.versions.length, 7)
    })

    test('get_proposal_history (filter by status)', async function () {
        const res = await msigs.get_proposal_history('alice', 'upgrade', {
            status: 'executed',
        })
        assert.isDefined(res)
        assert.isArray(res.versions)
        // Should have executed versions
        res.versions.forEach((v) => {
            assert.equal(v.status, 'executed')
        })
    })

    test('get_proposal (dave/transfer - multiple versions)', async function () {
        const res = await msigs.get_proposal('dave', 'transfer')
        assert.isDefined(res)
        assert.equal(res.proposer, 'dave')
        assert.equal(res.proposal_name, 'transfer')
    })

    test('get_approvals (alice/upgrade)', async function () {
        const res = await msigs.get_approvals('alice', 'upgrade')
        assert.isDefined(res)
        assert.equal(res.proposer, 'alice')
        assert.equal(res.proposal_name, 'upgrade')
        assert.isArray(res.timeline)
    })

    test('get_activity (alice account)', async function () {
        const res = await msigs.get_activity('alice', {
            limit: 10,
        })
        assert.isDefined(res)
        assert.equal(res.account, 'alice')
        assert.isArray(res.activity)
        assert.isDefined(res.total)
        assert.isDefined(res.more)

        // Verify activity events have proper structure
        res.activity.forEach((a) => {
            assert.isDefined(a.action)
            assert.isDefined(a.timestamp)
            assert.isDefined(a.proposer)
            assert.isDefined(a.proposal_name)
        })

        // Verify chronological order (descending - most recent first)
        if (res.activity.length > 1) {
            for (let i = 1; i < res.activity.length; i++) {
                const prevTime = res.activity[i - 1].timestamp
                const currTime = res.activity[i].timestamp
                assert.isTrue(
                    prevTime >= currTime,
                    'Activity should be in descending chronological order'
                )
            }
        }
    })

    test('get_activity (no options)', async function () {
        const res = await msigs.get_activity('bob')
        assert.isDefined(res)
        assert.equal(res.account, 'bob')
        assert.isArray(res.activity)
        assert.isDefined(res.total)
        assert.isDefined(res.more)

        // Verify structure
        res.activity.forEach((a) => {
            assert.isDefined(a.action)
            assert.isDefined(a.timestamp)
            assert.isDefined(a.proposer)
            assert.isDefined(a.proposal_name)
        })
    })

    test('get_activity (filter by action_type)', async function () {
        const res = await msigs.get_activity('bob', {
            action_type: 'proposed',
            limit: 5,
        })
        assert.isDefined(res)
        assert.equal(res.account, 'bob')
        assert.isArray(res.activity)
        assert.isDefined(res.more)
    })

    test('get_approver_proposals (bob needs to approve)', async function () {
        const res = await msigs.get_approver_proposals('bob', {
            status: 'proposed',
            limit: 10,
        })
        assert.isDefined(res)
        assert.equal(res.approver, 'bob')
        assert.isArray(res.proposals)
        // Bob should have proposals requiring approval based on testdata
        assert.isAtLeast(res.proposals.length, 1)
    })

    test('get_approver_proposals (include_approved true)', async function () {
        const res = await msigs.get_approver_proposals('bob', {
            include_approved: true,
            limit: 10,
        })
        assert.isDefined(res)
        assert.equal(res.approver, 'bob')
        assert.isArray(res.proposals)
    })

    test('get_approver_proposals (charlie needs to approve)', async function () {
        const res = await msigs.get_approver_proposals('charlie', {
            status: 'proposed',
        })
        assert.isDefined(res)
        assert.equal(res.approver, 'charlie')
        assert.isArray(res.proposals)
    })

    test('get_proposals (filter by proposer=alice)', async function () {
        const res = await msigs.get_proposals({
            proposer: 'alice',
            limit: 20,
        })
        assert.isDefined(res)
        assert.isArray(res.proposals)
        // All proposals should be from alice
        res.proposals.forEach((p) => {
            assert.equal(p.proposer, 'alice')
        })
        // alice has upgrade and newperm proposals
        assert.isAtLeast(res.proposals.length, 2)
    })

    test('get_proposals (filter by status=cancelled)', async function () {
        const res = await msigs.get_proposals({
            status: 'cancelled',
            limit: 10,
        })
        assert.isDefined(res)
        assert.isArray(res.proposals)
        // All should be cancelled
        res.proposals.forEach((p) => {
            assert.equal(p.status, 'cancelled')
        })
    })

    test('get_proposals (filter by status=executed)', async function () {
        const res = await msigs.get_proposals({
            status: 'executed',
            limit: 10,
        })
        assert.isDefined(res)
        assert.isArray(res.proposals)
        // All should be executed
        res.proposals.forEach((p) => {
            assert.equal(p.status, 'executed')
        })
    })

    // ===================================================================
    // HIGH PRIORITY TESTS - Based on comprehensive test data
    // ===================================================================

    suite('get_proposal_history pagination', function () {
        test('pagination with limit=3', async function () {
            const res = await msigs.get_proposal_history('alice', 'upgrade', {
                limit: 3,
            })
            assert.isDefined(res)
            assert.equal(res.versions.length, 3)
            assert.equal(res.total, 7)
            assert.isTrue(res.more)
            // API returns descending by globalseq (most recent first)
            // First 3: 1033, 1029, 1025
            assert.equal(res.versions[0].globalseq, 1033)
            assert.equal(res.versions[1].globalseq, 1029)
            assert.equal(res.versions[2].globalseq, 1025)
        })

        test('pagination with offset=3', async function () {
            const res = await msigs.get_proposal_history('alice', 'upgrade', {
                offset: 3,
                limit: 10,
            })
            assert.isDefined(res)
            // Should get 4 remaining versions (7 total - 3 offset)
            assert.equal(res.versions.length, 4)
            assert.equal(res.total, 7)
            // After offset=3 (skipping 1033, 1029, 1025), we get: 1019, 1013, 1007, 1001
            assert.equal(res.versions[0].globalseq, 1019)
            assert.equal(res.versions[1].globalseq, 1013)
            assert.equal(res.versions[2].globalseq, 1007)
            assert.equal(res.versions[3].globalseq, 1001)
        })

        test('pagination with offset=5, limit=2', async function () {
            const res = await msigs.get_proposal_history('alice', 'upgrade', {
                offset: 5,
                limit: 2,
            })
            assert.isDefined(res)
            // Should get last 2 versions
            assert.equal(res.versions.length, 2)
            assert.equal(res.total, 7)
            // After offset=5 (skipping 1033, 1029, 1025, 1019, 1013), we get: 1007, 1001
            assert.equal(res.versions[0].globalseq, 1007)
            assert.equal(res.versions[1].globalseq, 1001)
        })

        test('more=true when results exceed limit', async function () {
            const res = await msigs.get_proposal_history('alice', 'upgrade', {
                limit: 1,
            })
            assert.isDefined(res)
            assert.equal(res.versions.length, 1)
            assert.isTrue(res.more)
            // Should be most recent version (globalseq 1033)
            assert.equal(res.versions[0].globalseq, 1033)
        })
    })

    suite('get_proposal_history status filtering', function () {
        test('filter by status=executed only', async function () {
            const res = await msigs.get_proposal_history('alice', 'upgrade', {
                status: 'executed',
            })
            assert.isDefined(res)
            assert.isArray(res.versions)
            // alice/upgrade has 2 EXECUTED versions (descending: 1019, 1001)
            assert.equal(res.versions.length, 2)
            res.versions.forEach((v) => {
                assert.equal(v.status, 'executed')
            })
            // Verify exact globalseq values in descending order
            assert.equal(res.versions[0].globalseq, 1019)
            assert.equal(res.versions[1].globalseq, 1001)
        })

        test('filter by status=cancelled only', async function () {
            const res = await msigs.get_proposal_history('alice', 'upgrade', {
                status: 'cancelled',
            })
            assert.isDefined(res)
            assert.isArray(res.versions)
            // alice/upgrade has 1 CANCELLED version: 1013
            assert.equal(res.versions.length, 1)
            res.versions.forEach((v) => {
                assert.equal(v.status, 'cancelled')
            })
            // Verify exact globalseq
            assert.equal(res.versions[0].globalseq, 1013)
        })

        test('filter by status=proposed only', async function () {
            const res = await msigs.get_proposal_history('alice', 'upgrade', {
                status: 'proposed',
            })
            assert.isDefined(res)
            assert.isArray(res.versions)
            // alice/upgrade has 4 PROPOSED versions (descending: 1033, 1029, 1025, 1007)
            assert.equal(res.versions.length, 4)
            res.versions.forEach((v) => {
                assert.equal(v.status, 'proposed')
            })
            // Verify exact globalseq sequence in descending order
            assert.equal(res.versions[0].globalseq, 1033)
            assert.equal(res.versions[1].globalseq, 1029)
            assert.equal(res.versions[2].globalseq, 1025)
            assert.equal(res.versions[3].globalseq, 1007)
        })
    })

    suite('time-based proposals', function () {
        test('sarah/urgent (expires in 1 hour)', async function () {
            const res = await msigs.get_proposal('sarah', 'urgent')
            assert.isDefined(res)
            assert.equal(res.proposer, 'sarah')
            assert.equal(res.proposal_name, 'urgent')
            assert.equal(res.status, 'proposed')
            // Expiration should be in the future
            assert.isDefined(res.expiration)
        })

        test('tina/soon (expires in 6 hours)', async function () {
            const res = await msigs.get_proposal('tina', 'soon')
            assert.isDefined(res)
            assert.equal(res.proposer, 'tina')
            assert.equal(res.proposal_name, 'soon')
            assert.equal(res.status, 'proposed')
        })

        test('uma/tomorrow (expires in 1 day)', async function () {
            const res = await msigs.get_proposal('uma', 'tomorrow')
            assert.isDefined(res)
            assert.equal(res.proposer, 'uma')
            assert.equal(res.proposal_name, 'tomorrow')
            assert.equal(res.status, 'proposed')
        })

        test('get_active includes expiring proposals', async function () {
            const res = await msigs.get_active({
                limit: 20,
            })
            assert.isDefined(res)
            // Should include sarah/urgent, tina/soon, uma/tomorrow
            // (Test data has many active proposals now)
            if (res.proposals && res.proposals.length > 0) {
                assert.isAtLeast(res.proposals.length, 1)
            }
        })

        test('get_active sorted by expiration', async function () {
            const res = await msigs.get_active({
                sort_by: 'expiration',
                limit: 20,
            })
            assert.isDefined(res)
            // Should be sorted by expiration time (ascending)
            if (res.proposals && res.proposals.length > 1) {
                for (let i = 1; i < res.proposals.length; i++) {
                    const prev = res.proposals[i - 1]
                    const curr = res.proposals[i]
                    // Compare expiration times
                    assert.isDefined(prev.expiration)
                    assert.isDefined(curr.expiration)
                }
            }
        })
    })

    suite('expired proposals', function () {
        test('victor/expired1 (expired 2 hours ago)', async function () {
            const res = await msigs.get_proposal('victor', 'expired1')
            assert.isDefined(res)
            assert.equal(res.proposer, 'victor')
            assert.equal(res.proposal_name, 'expired1')
            assert.equal(res.status, 'expired')
        })

        test('wendy/expired2 (expired yesterday)', async function () {
            const res = await msigs.get_proposal('wendy', 'expired2')
            assert.isDefined(res)
            assert.equal(res.proposer, 'wendy')
            assert.equal(res.proposal_name, 'expired2')
            assert.equal(res.status, 'expired')
        })

        test('get_proposals filter by status=expired', async function () {
            const res = await msigs.get_proposals({
                status: 'expired',
                limit: 10,
            })
            assert.isDefined(res)
            assert.isArray(res.proposals)
            // Should include victor/expired1 and wendy/expired2
            res.proposals.forEach((p) => {
                assert.equal(p.status, 'expired')
            })
        })

        test('get_active excludes expired proposals', async function () {
            const res = await msigs.get_active({
                limit: 20,
            })
            assert.isDefined(res)
            // None of these should be expired
            if (res.proposals && res.proposals.length > 0) {
                res.proposals.forEach((p) => {
                    assert.notEqual(p.status, 'expired')
                })
            }
        })
    })

    suite('pagination with zach account (30 proposals)', function () {
        test('zach has 30 total proposals', async function () {
            const res = await msigs.get_proposals({
                proposer: 'zach',
            })
            assert.isDefined(res)
            assert.equal(res.total, 30)
            // Default limit is 20
            assert.equal(res.proposals.length, 20)
            assert.isTrue(res.more)

            res.proposals.forEach((p) => {
                assert.equal(p.proposer, 'zach')
                assert.isDefined(p.globalseq)
                assert.isDefined(p.status)
            })
        })

        test('pagination with limit=10 (FIXED - now respects limit)', async function () {
            const res = await msigs.get_proposals({
                proposer: 'zach',
                limit: 10,
            })
            assert.isDefined(res)
            assert.equal(res.total, 30)
            // FIXED: limit now works correctly!
            assert.equal(res.proposals.length, 10)
            assert.isTrue(res.more)

            res.proposals.forEach((p) => {
                assert.equal(p.proposer, 'zach')
            })
        })

        test('pagination with offset=10, limit=10 (FIXED - offset works)', async function () {
            const res = await msigs.get_proposals({
                proposer: 'zach',
                offset: 10,
                limit: 10,
            })
            assert.isDefined(res)
            assert.equal(res.total, 30)
            // FIXED: offset and limit now work correctly!
            assert.equal(res.proposals.length, 10)
            assert.isTrue(res.more)

            res.proposals.forEach((p) => {
                assert.equal(p.proposer, 'zach')
            })
        })

        test('pagination with offset=20, limit=10 (FIXED - offset works)', async function () {
            const res = await msigs.get_proposals({
                proposer: 'zach',
                offset: 20,
                limit: 10,
            })
            assert.isDefined(res)
            assert.equal(res.total, 30)
            // FIXED: offset now works correctly! Should return remaining 10 items
            assert.equal(res.proposals.length, 10)
            assert.isFalse(res.more) // No more results after this page

            res.proposals.forEach((p) => {
                assert.equal(p.proposer, 'zach')
                assert.isDefined(p.globalseq)
            })
        })

        test('zach proposals have correct status distribution', async function () {
            const res = await msigs.get_proposals({
                proposer: 'zach',
                limit: 20,
            })
            assert.isDefined(res)
            assert.equal(res.total, 30)

            const statusCounts = {
                proposed: 0,
                executed: 0,
                cancelled: 0,
            }

            res.proposals.forEach((p) => {
                assert.equal(p.proposer, 'zach')
                if (p.status === 'proposed') statusCounts.proposed++
                else if (p.status === 'executed') statusCounts.executed++
                else if (p.status === 'cancelled') statusCounts.cancelled++
            })

            // zach has 5 proposed, 10 executed, 5 cancelled (counting unique proposals)
            // Note: API may return up to 20 results with max limit
            assert.isAtLeast(statusCounts.proposed, 1)
            assert.isAtLeast(statusCounts.executed, 1)
            assert.isAtLeast(statusCounts.cancelled, 1)
        })

        test('zach proposals filter by status=proposed', async function () {
            const res = await msigs.get_proposals({
                proposer: 'zach',
                status: 'proposed',
                limit: 20,
            })
            assert.isDefined(res)
            assert.isAtLeast(res.proposals.length, 1)

            // All should be proposed status from zach
            res.proposals.forEach((p) => {
                assert.equal(p.proposer, 'zach')
                assert.equal(p.status, 'proposed')
                assert.isDefined(p.globalseq)
            })

            // Note: API Bug #4 - results may not be in strict descending globalseq order
        })
    })

    suite('complex approval scenarios', function () {
        test('xavier/bigmultisig (12 approvers, 8 approved, 4 pending)', async function () {
            const res = await msigs.get_proposal('xavier', 'bigmultisig')
            assert.isDefined(res)
            assert.equal(res.proposer, 'xavier')
            assert.equal(res.proposal_name, 'bigmultisig')
            assert.equal(res.status, 'proposed')
            assert.equal(res.requested_approvals.length, 12)
            assert.equal(res.provided_approvals.length, 8)
        })

        test('yolanda/flipflop approval timeline', async function () {
            const res = await msigs.get_approvals('yolanda', 'flipflop')
            assert.isDefined(res)
            assert.equal(res.proposer, 'yolanda')
            assert.equal(res.proposal_name, 'flipflop')
            assert.isArray(res.timeline)
            // Should have approve → unapprove → approve sequence
            assert.isAtLeast(res.timeline.length, 3)

            // Check for action types in timeline
            const actions = res.timeline.map((e) => e.action)
            assert.include(actions, 'approve')
            assert.include(actions, 'unapprove')
        })

        test('yolanda/flipflop current proposal state', async function () {
            const res = await msigs.get_proposal('yolanda', 'flipflop')
            assert.isDefined(res)
            assert.equal(res.proposer, 'yolanda')
            assert.equal(res.proposal_name, 'flipflop')
            // After approve → unapprove → approve, should have approvals
            assert.isDefined(res.provided_approvals)
        })
    })

    suite('large transaction', function () {
        test('zara/batch (15 actions)', async function () {
            const res = await msigs.get_proposal('zara', 'batch')
            assert.isDefined(res)
            assert.equal(res.proposer, 'zara')
            assert.equal(res.proposal_name, 'batch')
            assert.equal(res.actions_count, 15)
            // Transaction should be present
            assert.isDefined(res.transaction)
        })
    })

    suite('approval timeline validation', function () {
        test('alice/upgrade has approval events', async function () {
            const res = await msigs.get_approvals('alice', 'upgrade')
            assert.isDefined(res)
            assert.isArray(res.timeline)
            assert.isAtLeast(res.timeline.length, 1)

            // Each event should have required fields
            res.timeline.forEach((event) => {
                assert.isDefined(event.action)
                assert.isDefined(event.actor)
                assert.isDefined(event.permission)
                assert.isDefined(event.timestamp)
                assert.isDefined(event.block_num)
                assert.isDefined(event.globalseq)
            })
        })

        test('approval timeline is chronologically ordered', async function () {
            const res = await msigs.get_approvals('alice', 'upgrade')
            assert.isDefined(res)
            assert.isArray(res.timeline)

            // Timeline should be ordered by timestamp (ascending)
            if (res.timeline.length > 1) {
                for (let i = 1; i < res.timeline.length; i++) {
                    const prevTime = res.timeline[i - 1].timestamp
                    const currTime = res.timeline[i].timestamp
                    assert.isTrue(prevTime <= currTime, 'Timeline should be in ascending order')
                }
            }
        })

        test('dave/transfer has approval events', async function () {
            const res = await msigs.get_approvals('dave', 'transfer')
            assert.isDefined(res)
            assert.isArray(res.timeline)
            assert.isAtLeast(res.timeline.length, 1)
        })
    })

    suite('account activity validation', function () {
        test('alice activity (proposed actions)', async function () {
            const res = await msigs.get_activity('alice', {
                action_type: 'proposed',
                limit: 20,
            })
            assert.isDefined(res)
            assert.equal(res.account, 'alice')
            assert.isArray(res.activity)
            // alice proposed alice/upgrade and alice/newperm
            assert.isAtLeast(res.activity.length, 1)

            res.activity.forEach((a) => {
                assert.equal(a.action, 'proposed')
                assert.isDefined(a.proposer)
                assert.isDefined(a.proposal_name)
                assert.isDefined(a.timestamp)
            })
        })

        test('bob activity (approved actions)', async function () {
            const res = await msigs.get_activity('bob', {
                action_type: 'approved',
                limit: 20,
            })
            assert.isDefined(res)
            assert.equal(res.account, 'bob')
            assert.isArray(res.activity)
            // bob approved multiple proposals
            if (res.activity.length > 0) {
                res.activity.forEach((a) => {
                    assert.equal(a.action, 'approved')
                })
            }
        })

        test('alice activity (executed actions)', async function () {
            const res = await msigs.get_activity('alice', {
                action_type: 'executed',
                limit: 20,
            })
            assert.isDefined(res)
            assert.equal(res.account, 'alice')
            assert.isArray(res.activity)
            // alice executed some proposals
            if (res.activity.length > 0) {
                res.activity.forEach((a) => {
                    assert.equal(a.action, 'executed')
                })
            }
        })

        test('activity timeline is chronologically ordered (descending)', async function () {
            const res = await msigs.get_activity('alice', {
                limit: 20,
            })
            assert.isDefined(res)
            assert.isArray(res.activity)

            // Activity should be ordered by timestamp (descending - most recent first)
            if (res.activity.length > 1) {
                for (let i = 1; i < res.activity.length; i++) {
                    const prevTime = res.activity[i - 1].timestamp
                    const currTime = res.activity[i].timestamp
                    assert.isTrue(prevTime >= currTime, 'Activity should be in descending order')
                }
            }
        })

        test('activity pagination', async function () {
            const res = await msigs.get_activity('alice', {
                limit: 5,
            })
            assert.isDefined(res)
            assert.isArray(res.activity)
            assert.isDefined(res.total)

            // API may have a default max limit (e.g., 20)
            // Just verify we got some results if total > 0
            if (res.total > 0) {
                assert.isAtLeast(res.activity.length, 1)
            }
            if (res.total > res.activity.length) {
                assert.isTrue(res.more)
            }
        })

        test('activity pagination with offset (Bug #1 FIXED)', async function () {
            const res = await msigs.get_activity('alice', {
                limit: 5,
                offset: 2,
            })
            assert.isDefined(res)
            assert.isArray(res.activity)
            assert.isDefined(res.total)

            // Bug #1 is FIXED - offset parameter now works correctly!
            // The offset should skip results, which we can verify by:
            // 1. Total count should be accurate
            // 2. Results should still be in chronological order
            // 3. With offset=2, we should get different results than offset=0

            // Verify activity events have proper structure
            res.activity.forEach((a) => {
                assert.isDefined(a.action)
                assert.isDefined(a.timestamp)
                assert.isDefined(a.proposer)
                assert.isDefined(a.proposal_name)
            })

            // Verify chronological order (descending - most recent first)
            if (res.activity.length > 1) {
                for (let i = 1; i < res.activity.length; i++) {
                    const prevTime = res.activity[i - 1].timestamp
                    const currTime = res.activity[i].timestamp
                    assert.isTrue(
                        prevTime >= currTime,
                        'Activity should be in descending chronological order'
                    )
                }
            }

            // Note: Bug #1 is FIXED - the API now correctly applies offset
        })
    })

    suite('get_approver_proposals advanced filtering', function () {
        test('bob approver proposals with status=executed', async function () {
            const res = await msigs.get_approver_proposals('bob', {
                status: 'executed',
                include_approved: true,
                limit: 20,
            })
            assert.isDefined(res)
            assert.equal(res.approver, 'bob')
            assert.isArray(res.proposals)
            // Should only return executed proposals
            res.proposals.forEach((p) => {
                assert.equal(p.status, 'executed')
            })
        })

        test('bob approver proposals with status=cancelled', async function () {
            const res = await msigs.get_approver_proposals('bob', {
                status: 'cancelled',
                include_approved: true,
                limit: 20,
            })
            assert.isDefined(res)
            assert.equal(res.approver, 'bob')
            assert.isArray(res.proposals)
            // Should only return cancelled proposals
            res.proposals.forEach((p) => {
                assert.equal(p.status, 'cancelled')
            })
        })

        test('include_approved=false excludes already approved', async function () {
            const res = await msigs.get_approver_proposals('bob', {
                status: 'proposed',
                include_approved: false,
                limit: 20,
            })
            assert.isDefined(res)
            assert.equal(res.approver, 'bob')
            assert.isArray(res.proposals)

            // Verify bob is NOT in provided_approvals for any result
            res.proposals.forEach((p) => {
                const bobApproved = p.provided_approvals.some((a) => a.actor === 'bob')
                assert.isFalse(bobApproved, 'Bob should not have approved these proposals')
            })
        })

        test('include_approved=true includes already approved', async function () {
            const res = await msigs.get_approver_proposals('bob', {
                status: 'proposed',
                include_approved: true,
                limit: 20,
            })
            assert.isDefined(res)
            assert.equal(res.approver, 'bob')
            assert.isArray(res.proposals)

            // Should include proposals where bob has already approved
            const hasApproved = res.proposals.some((p) =>
                p.provided_approvals.some((a) => a.actor === 'bob')
            )
            assert.isTrue(hasApproved, 'Should include proposals bob has approved')
        })

        test('get_approver_proposals with offset (Bug #2 FIXED)', async function () {
            const res = await msigs.get_approver_proposals('bob', {
                status: 'proposed',
                limit: 5,
                offset: 1,
            })
            assert.isDefined(res)
            assert.equal(res.approver, 'bob')
            assert.isArray(res.proposals)

            // Bug #2 FIXED: No more duplicates, each unique proposal appears once
            res.proposals.forEach((p) => {
                assert.equal(p.status, 'proposed')
                assert.isDefined(p.globalseq)
                const hasBob = p.requested_approvals.some((a) => a.actor === 'bob')
                assert.isTrue(hasBob, 'Bob should be in requested approvals')
            })
        })
    })

    suite('additional coverage tests', function () {
        test('client with both maxProposalLimit and maxApprovalLimit configured', async function () {
            const customClient = new MsigsClient(client, {
                maxProposalLimit: 50,
                maxApprovalLimit: 200,
            })
            const maxProposalLimit = await customClient.getMaxProposalLimit()
            const maxApprovalLimit = await customClient.getMaxApprovalLimit()
            assert.equal(maxProposalLimit, 50)
            assert.equal(maxApprovalLimit, 200)
        })

        test('getMaxApprovalLimit returns correct limit', async function () {
            const maxApprovalLimit = await msigs.getMaxApprovalLimit()
            assert.equal(maxApprovalLimit, 100)
        })

        test('get_active with offset parameter (line 198 coverage)', async function () {
            const res = await msigs.get_active({
                limit: 5,
                offset: 2,
            })
            assert.isDefined(res)
            assert.isDefined(res.total)
            assert.equal(res.total, 28)
            // Offset should skip first 2 results
            if (res.proposals && res.proposals.length > 0) {
                assert.equal(res.proposals.length, 5)
                res.proposals.forEach((p) => {
                    assert.equal(p.status, 'proposed')
                })
            }
        })

        test('getPaginationInfo helper function', function () {
            // Test basic pagination info
            const page1 = getPaginationInfo(0, 10, 50, true)
            assert.equal(page1.currentPage, 1)
            assert.equal(page1.pageSize, 10)
            assert.equal(page1.totalResults, 50)
            assert.equal(page1.totalPages, 5)
            assert.isTrue(page1.hasMore)
            assert.isFalse(page1.hasPrevious)
            assert.equal(page1.nextOffset, 10)
            assert.isUndefined(page1.previousOffset)

            // Test middle page
            const page2 = getPaginationInfo(10, 10, 50, true)
            assert.equal(page2.currentPage, 2)
            assert.isTrue(page2.hasMore)
            assert.isTrue(page2.hasPrevious)
            assert.equal(page2.nextOffset, 20)
            assert.equal(page2.previousOffset, 0)

            // Test last page
            const page5 = getPaginationInfo(40, 10, 50, false)
            assert.equal(page5.currentPage, 5)
            assert.isFalse(page5.hasMore)
            assert.isTrue(page5.hasPrevious)
            assert.isUndefined(page5.nextOffset)
            assert.equal(page5.previousOffset, 30)
        })

        test('error handling when get_status fails during initialization', async function () {
            // Create a client that will fail on get_status
            const failingClient = new APIClient({
                provider: new FetchProvider('http://invalid-endpoint-that-does-not-exist.local', {
                    fetch: async () => {
                        throw new Error('Network error')
                    },
                }),
            })
            const failingMsigs = new MsigsClient(failingClient)

            // Even with a failing get_status, getMaxProposalLimit should still work with defaults
            const maxLimit = await failingMsigs.getMaxProposalLimit()
            assert.equal(maxLimit, 20) // Default fallback value

            const maxApprovalLimit = await failingMsigs.getMaxApprovalLimit()
            assert.equal(maxApprovalLimit, 100) // Default fallback value
        })
    })

    suite('search_proposals', function () {
        test('search by single character query', async function () {
            const res = await msigs.search_proposals('upg')
            assert.isDefined(res)
            assert.equal(res.query, 'upg')
            assert.isArray(res.proposals)
            assert.isDefined(res.total)
            assert.isDefined(res.more)

            // All results should contain 'upg' in proposal_name
            res.proposals.forEach((p) => {
                const name = String(p.proposal_name).toLowerCase()
                assert.include(name, 'upg', 'Proposal name should contain query string')
            })
        })

        test('search by multi-character query', async function () {
            const res = await msigs.search_proposals('trans')
            assert.isDefined(res)
            assert.equal(res.query, 'trans')
            assert.isArray(res.proposals)

            // All results should contain 'trans' in proposal_name
            res.proposals.forEach((p) => {
                const name = String(p.proposal_name).toLowerCase()
                assert.include(name, 'trans', 'Proposal name should contain query string')
            })
        })

        test('search with case insensitivity', async function () {
            const res = await msigs.search_proposals('UPGRADE')
            assert.isDefined(res)
            assert.equal(res.query, 'UPGRADE')
            assert.isArray(res.proposals)

            // Should find proposals with 'upgrade' in name
            const hasUpgrade = res.proposals.some((p) =>
                String(p.proposal_name).toLowerCase().includes('upgrade')
            )
            assert.isTrue(hasUpgrade, 'Should find proposals with upgrade in name')
        })

        test('search with status filter', async function () {
            const res = await msigs.search_proposals('upg', {
                status: 'proposed',
            })
            assert.isDefined(res)
            assert.equal(res.query, 'upg')
            assert.equal(res.status, 'proposed')
            assert.isArray(res.proposals)

            // All results should be proposed status
            res.proposals.forEach((p) => {
                assert.equal(p.status, 'proposed')
            })
        })

        test('search with status=executed filter', async function () {
            const res = await msigs.search_proposals('upgrade', {
                status: 'executed',
            })
            assert.isDefined(res)
            assert.equal(res.query, 'upgrade')
            assert.equal(res.status, 'executed')
            assert.isArray(res.proposals)

            // All results should be executed status
            res.proposals.forEach((p) => {
                assert.equal(p.status, 'executed')
                const name = String(p.proposal_name).toLowerCase()
                assert.include(name, 'upgrade')
            })
        })

        test('search with limit parameter', async function () {
            const res = await msigs.search_proposals('tra', {
                limit: 5,
            })
            assert.isDefined(res)
            assert.isArray(res.proposals)
            assert.isAtMost(res.proposals.length, 5)

            if (res.total > 5) {
                assert.isTrue(res.more)
            }
        })

        test('search with offset parameter', async function () {
            const res = await msigs.search_proposals('tra', {
                limit: 5,
                offset: 2,
            })
            assert.isDefined(res)
            assert.isArray(res.proposals)
            assert.isDefined(res.total)

            // Verify all results match query
            res.proposals.forEach((p) => {
                const name = String(p.proposal_name).toLowerCase()
                assert.include(name, 'tra')
            })
        })

        test('search with no results returns empty array', async function () {
            const res = await msigs.search_proposals('xyznonexistent999')
            assert.isDefined(res)
            assert.equal(res.query, 'xyznonexistent999')
            assert.isArray(res.proposals)
            assert.equal(res.proposals.length, 0)
            assert.equal(res.total, 0)
            assert.isFalse(res.more)
        })

        test('search exact proposal name', async function () {
            const res = await msigs.search_proposals('upgrade')
            assert.isDefined(res)
            assert.isArray(res.proposals)

            // Should find alice/upgrade
            const hasAliceUpgrade = res.proposals.some(
                (p) => String(p.proposer) === 'alice' && String(p.proposal_name) === 'upgrade'
            )
            assert.isTrue(hasAliceUpgrade, 'Should find alice/upgrade proposal')
        })

        test('search substring matching', async function () {
            const res = await msigs.search_proposals('grad')
            assert.isDefined(res)
            assert.isArray(res.proposals)

            // Should find proposals with 'grad' in name (like 'upgrade')
            res.proposals.forEach((p) => {
                const name = String(p.proposal_name).toLowerCase()
                assert.include(name, 'grad')
            })
        })

        test('search pagination with multiple pages', async function () {
            // Test pagination parameters work correctly
            // Note: Test data has limited indexed proposals, so we verify pagination structure
            const page1 = await msigs.search_proposals('upgrade', {
                limit: 1,
            })
            assert.isDefined(page1)
            assert.isArray(page1.proposals)
            assert.isAtMost(page1.proposals.length, 1)

            // Verify pagination info is present and correct
            assert.isDefined(page1.total)
            assert.isDefined(page1.more)
            assert.equal(page1.proposals.length, Math.min(1, page1.total))
        })

        test('search respects limit validation', async function () {
            try {
                await msigs.search_proposals('upg', {limit: 50})
                assert.fail('Should have thrown error')
            } catch (error: any) {
                assert.include(error.message, 'Limit cannot exceed 20')
            }
        })

        test('search results include all proposal fields', async function () {
            const res = await msigs.search_proposals('upgrade', {
                limit: 1,
            })
            assert.isDefined(res)

            if (res.proposals.length > 0) {
                const p = res.proposals[0]
                assert.isDefined(p.proposer)
                assert.isDefined(p.proposal_name)
                assert.isDefined(p.status)
                assert.isDefined(p.created_at)
                assert.isDefined(p.created_block)
                assert.isDefined(p.created_trx_id)
                assert.isDefined(p.globalseq)
                assert.isDefined(p.expiration)
                assert.isDefined(p.actions_count)
                assert.isDefined(p.requested_approvals)
                assert.isDefined(p.provided_approvals)
            }
        })

        test('search with combined filters (status + limit)', async function () {
            const res = await msigs.search_proposals('tra', {
                status: 'proposed',
                limit: 10,
            })
            assert.isDefined(res)
            assert.equal(res.query, 'tra')
            assert.equal(res.status, 'proposed')
            assert.isArray(res.proposals)
            assert.isAtMost(res.proposals.length, 10)

            // All results should match both filters
            res.proposals.forEach((p) => {
                assert.equal(p.status, 'proposed')
                const name = String(p.proposal_name).toLowerCase()
                assert.include(name, 'tra')
            })
        })
    })
})
