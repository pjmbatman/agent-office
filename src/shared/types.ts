// ===== Team Types =====

export type TeamId = 'alpha' | 'beta'

export type TeamMemberRole = 'lead' | 'senior' | 'worker1' | 'worker2'

export interface TeamConfig {
  id: TeamId
  enabled: boolean
  displayName: string
  providerOptions?: ProviderOptions
}

export type TeamWorkflowState =
  | 'idle'
  | 'lead-analyzing'
  | 'workers-executing'
  | 'senior-consolidating'
  | 'lead-evaluating'
  | 'complete'

export interface WorkerRoleAssignment {
  agentId: string
  workerId: string
  assignedRole: string
  instructions: string
}

export interface TeamWorkflowContext {
  teamId: TeamId
  state: TeamWorkflowState
  criteria: string[]
  roleAssignments: WorkerRoleAssignment[]
  workerOutputs: Record<string, string>
  consolidatedReport: string | null
  feedback: string | null
  iterations: number
}

export interface TeamResult {
  teamId: TeamId
  result: string
  criteria: string[]
  satisfied: boolean
  iterations: number
  artifacts: string[]
}

// ===== Agent Provider Types =====

export type ProviderType = 'claude-code' | 'codex' | 'custom'

export type ExecutionTarget = LocalTarget | RemoteTarget

export interface LocalTarget {
  type: 'local'
}

export interface RemoteTarget {
  type: 'remote'
  sshHost: string
  remoteWorkspacePath: string
  host?: string
  port?: number
  user?: string
  authMethod?: 'ssh-key' | 'password'
  keyPath?: string
  password?: string
}

export interface ProviderOptions {
  model?: string
  maxTurns?: number
  extraArgs?: string[]
}

export interface SpawnConfig {
  provider: ProviderType
  target: ExecutionTarget
  role: RoleConfig
  prompt: string
  workspacePath: string
  providerOptions?: ProviderOptions
}

export type RoleKind = 'planner' | 'researcher' | 'implementer' | 'reviewer' | 'general'

export interface RoleConfig {
  name: string
  displayName: string
  kind: RoleKind
  teamId?: TeamId
  teamMemberRole?: TeamMemberRole
  systemPromptTemplate: string
  allowedTools?: string[]
}

// ===== Agent Event Types =====

export interface AgentEvent {
  type: 'text-delta' | 'tool-use' | 'tool-result' | 'complete' | 'error'
  content: string
  metadata?: Record<string, unknown>
}

export interface PipelineStage {
  key: string
  label: string
  role?: AgentRole | null
  goal?: string
}

// ===== Transport Types =====

export interface TransportProcess {
  stdout: AsyncIterable<string>
  stderr: AsyncIterable<string>
  kill: () => void
  exitCode: Promise<number>
}

// ===== Workflow Types =====

export type WorkflowState =
  | 'idle'
  | 'teams-working'
  | 'ceo-comparing'
  | 'complete'
  // Legacy states kept for state machine compatibility
  | 'planning'
  | 'researching'
  | 'implementing'
  | 'reviewing'
  | 'revision'

export type AgentRole = string

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'talking' | 'done' | 'error'

export interface TaskRecord {
  id: string
  description: string
  status: WorkflowState
  plan?: string
  evaluationCriteria?: string[]
  pipelineStages?: PipelineStage[]
  currentStageKey?: string | null
  research?: string
  implementation?: string
  review?: { approved: boolean; feedback: string }
  revisionCount: number
  artifacts: string[]
  createdAt: number
  updatedAt: number
}

export interface AgentStatusUpdate {
  role: AgentRole
  status: AgentStatus
  currentAction?: string
  provider: ProviderType
  target: ExecutionTarget
}

export interface AgentOutputChunk {
  role: AgentRole
  event: AgentEvent
}

// ===== Character/Office Types =====

export interface CharacterConfig {
  role: AgentRole
  displayName: string
  provider: ProviderType
  target: ExecutionTarget
  deskPosition: { x: number; y: number }
  spriteKey: string
}
