/**
 * SessionModal Component
 * Story 2.3: Session Creation REST API and Modal Dialog
 * Story 4.14: Existing Branch Selection for Sessions
 *
 * Modal dialog for creating new sessions with auto-generated names
 * and branch name auto-update functionality.
 * Extended with branch selection mode to choose existing branches.
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, GitBranch, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import type { Session, Branch } from '@/types'

export interface SessionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSessionCreated: (session: Session) => void
}

/**
 * Generate auto-generated session name in format: feature-YYYY-MM-DD-NNN
 */
function generateSessionName(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const counter = '001' // Simplified - in production would track daily counter

  return `feature-${year}-${month}-${day}-${counter}`
}

/**
 * SessionModal Component
 *
 * Features:
 * - Pre-filled auto-generated session name
 * - Auto-update branch name when session name changes
 * - Loading spinner during session creation
 * - Error message display
 * - Cancel and Create buttons
 */
export function SessionModal({ open, onOpenChange, onSessionCreated }: SessionModalProps) {
  const [sessionName, setSessionName] = useState('')
  const [branchName, setBranchName] = useState('')
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [branchFilter, setBranchFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mainBranchConfirmed, setMainBranchConfirmed] = useState(false)

  // Initialize with auto-generated name when modal opens
  useEffect(() => {
    if (open) {
      const autoName = generateSessionName()
      setSessionName(autoName)
      setBranchName(`feature/${autoName}`)
      setMode('new')
      setSelectedBranch(null)
      setBranchFilter('')
      setMainBranchConfirmed(false)
      setError(null)
    }
  }, [open])

  // Fetch branches when switching to existing mode
  useEffect(() => {
    if (open && mode === 'existing' && branches.length === 0) {
      fetchBranches()
    }
  }, [open, mode])

  // Auto-update branch name when session name changes (new mode only)
  useEffect(() => {
    if (sessionName && mode === 'new') {
      setBranchName(`feature/${sessionName}`)
    }
  }, [sessionName, mode])

  // Reset main branch confirmation when branch changes
  useEffect(() => {
    if (mode === 'existing' && selectedBranch) {
      const isMainBranch = selectedBranch.name === 'main' || selectedBranch.name === 'master'
      if (!isMainBranch) {
        setMainBranchConfirmed(false)
      }
    }
  }, [selectedBranch, mode])

  /**
   * Fetch branches from backend
   */
  async function fetchBranches() {
    try {
      setLoadingBranches(true)
      const response = await fetch('/api/git/branches')
      if (!response.ok) {
        throw new Error('Failed to fetch branches')
      }
      const data = await response.json()
      setBranches(data.branches || [])
    } catch (err) {
      console.error('Failed to fetch branches:', err)
      setError('Failed to load branches. You can still create a new branch.')
    } finally {
      setLoadingBranches(false)
    }
  }

  /**
   * Filter branches by search query
   */
  const filteredBranches = branches
    .filter(branch => !branch.hasActiveSession)
    .filter(branch =>
      branchFilter === '' ||
      branch.name.toLowerCase().includes(branchFilter.toLowerCase())
    )
    .sort((a, b) => new Date(b.lastCommit.date).getTime() - new Date(a.lastCommit.date).getTime())
    .slice(0, 20)

  /**
   * Check if main/master branch selected
   */
  const isMainBranchSelected: boolean =
    mode === 'existing' &&
    selectedBranch !== null &&
    (selectedBranch.name === 'main' || selectedBranch.name === 'master')

  /**
   * Check if submit button should be disabled
   */
  const isSubmitDisabled =
    loading ||
    !sessionName ||
    (mode === 'existing' && !selectedBranch) ||
    (isMainBranchSelected && !mainBranchConfirmed)

  /**
   * Handle session creation
   * Sends POST request to /api/sessions
   * Story 4.14: Extended to support existingBranch parameter
   */
  const handleCreate = async () => {
    try {
      setLoading(true)
      setError(null)

      // Prepare request payload
      const payload: { name: string; branch: string; existingBranch?: boolean } = {
        name: sessionName,
        branch: mode === 'existing' && selectedBranch ? selectedBranch.name : branchName,
      }

      if (mode === 'existing') {
        payload.existingBranch = true
      }

      // Send POST request to backend
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        // Story 2.11: Display MAX_SESSIONS error with user-friendly message
        if (errorData.code === 'MAX_SESSIONS') {
          throw new Error('Maximum 4 sessions supported. Destroy a session to create a new one.')
        }
        // Story 4.14: Handle worktree conflict and branch validation errors
        if (errorData.error?.message) {
          throw new Error(errorData.error.message)
        }
        throw new Error(errorData.error || 'Failed to create session')
      }

      const data = await response.json()
      const session = data.session

      // Notify parent component
      onSessionCreated(session)

      // Close modal
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle cancel button click
   */
  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Session</DialogTitle>
          <DialogDescription>
            Create a new development session with a dedicated git worktree and terminal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Session Name Input */}
          <div className="grid gap-2">
            <Label htmlFor="session-name">Session Name</Label>
            <Input
              id="session-name"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="feature-2025-11-24-001"
              disabled={loading}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Alphanumeric with dashes only, max 50 characters
            </p>
          </div>

          {/* Branch Selection Mode */}
          <div className="grid gap-3">
            <Label>Branch</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'new' | 'existing')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="mode-new" disabled={loading} />
                <Label htmlFor="mode-new" className="font-normal cursor-pointer">
                  Create new branch
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="mode-existing" disabled={loading} />
                <Label htmlFor="mode-existing" className="font-normal cursor-pointer">
                  Use existing branch
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* New Branch Input */}
          {mode === 'new' && (
            <div className="grid gap-2">
              <Label htmlFor="branch-name">New Branch Name</Label>
              <Input
                id="branch-name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="feature/feature-2025-11-24-001"
                disabled={loading}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Git branch name (auto-filled from session name)
              </p>
            </div>
          )}

          {/* Existing Branch Selection */}
          {mode === 'existing' && (
            <div className="grid gap-2">
              <Label htmlFor="branch-filter">Select Existing Branch</Label>
              {loadingBranches ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading branches...</span>
                </div>
              ) : (
                <>
                  <Input
                    id="branch-filter"
                    placeholder="Filter branches..."
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    disabled={loading}
                    className="w-full"
                  />
                  <div className="max-h-[200px] overflow-y-auto border rounded-md">
                    {filteredBranches.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        {branchFilter ? `No branches found matching "${branchFilter}"` : 'No available branches'}
                      </div>
                    ) : (
                      filteredBranches.map((branch) => (
                        <button
                          key={branch.name}
                          type="button"
                          onClick={() => setSelectedBranch(branch)}
                          disabled={loading}
                          className={`w-full px-3 py-2 text-left hover:bg-secondary transition-colors border-b last:border-b-0 ${
                            selectedBranch?.name === branch.name ? 'bg-secondary' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <GitBranch className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{branch.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {branch.lastCommit.message}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {branch.lastCommit.author} • {new Date(branch.lastCommit.date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  {selectedBranch && (
                    <p className="text-xs text-muted-foreground">
                      Selected: <strong>{selectedBranch.name}</strong>
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Main/Master Branch Warning */}
          {isMainBranchSelected && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Warning: Working directly on '{selectedBranch?.name}'</p>
                  <p className="text-sm">
                    This is not recommended. Consider creating a feature branch instead.
                  </p>
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="main-confirm"
                      checked={mainBranchConfirmed}
                      onCheckedChange={(checked) => setMainBranchConfirmed(checked === true)}
                    />
                    <Label htmlFor="main-confirm" className="font-normal cursor-pointer text-sm">
                      I understand the risks
                    </Label>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={isSubmitDisabled}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Creating...' : 'Create Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
