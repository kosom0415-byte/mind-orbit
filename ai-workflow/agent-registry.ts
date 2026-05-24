export type AgentId =
  | "GPT_PM_AGENT"
  | "CODEX_ENGINEER_AGENT"
  | "CLAUDE_REVIEWER_AGENT"
  | "CURSOR_UI_AGENT"
  | "SELF_HEAL_AGENT"
  | "RELEASE_MANAGER_AGENT"
  | "WATCHER_AGENT"
  | "HUMAN_VISION_OWNER";

export type AgentStatus = "idle" | "available" | "running" | "blocked" | "human-only";

export interface RuntimeAgent {
  id: AgentId;
  role: string;
  capabilities: string[];
  blockedActions: string[];
  approvalRequiredActions: string[];
  currentStatus: AgentStatus;
  maxAutonomousLevel: number;
  canModifyProduction: boolean;
  canTriggerRollback: boolean;
  canApproveHighRisk: boolean;
  canEditUI: boolean;
  canEditCoreRuntime: boolean;
  riskLimit: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export const AGENT_REGISTRY: Record<AgentId, RuntimeAgent> = {
  GPT_PM_AGENT: {
    id: "GPT_PM_AGENT",
    role: "Product planning, priority, blocked question resolution",
    capabilities: ["task_prioritization", "handoff_generation", "approval_request_framing", "risk_triage"],
    blockedActions: ["production_deploy", "rollback_execution", "env_access", "destructive_command"],
    approvalRequiredActions: ["high_risk_scope_change", "production_release_request"],
    currentStatus: "available",
    maxAutonomousLevel: 3,
    canModifyProduction: false,
    canTriggerRollback: false,
    canApproveHighRisk: false,
    canEditUI: false,
    canEditCoreRuntime: false,
    riskLimit: "MEDIUM",
  },
  CODEX_ENGINEER_AGENT: {
    id: "CODEX_ENGINEER_AGENT",
    role: "Repository implementation, validation, engineering reports",
    capabilities: ["code_editing", "build_validation", "reporting", "queue_execution", "safe_refactor"],
    blockedActions: ["production_deploy", "rollback_execution", "env_access", "force_push", "destructive_command"],
    approvalRequiredActions: ["high_risk_file_edit", "core_runtime_edit", "dependency_upgrade"],
    currentStatus: "available",
    maxAutonomousLevel: 4,
    canModifyProduction: false,
    canTriggerRollback: false,
    canApproveHighRisk: false,
    canEditUI: true,
    canEditCoreRuntime: false,
    riskLimit: "MEDIUM",
  },
  CLAUDE_REVIEWER_AGENT: {
    id: "CLAUDE_REVIEWER_AGENT",
    role: "Architecture and runtime risk review",
    capabilities: ["risk_review", "react_antipattern_detection", "architecture_review", "hallucination_check"],
    blockedActions: ["production_deploy", "rollback_execution", "env_access", "direct_code_push"],
    approvalRequiredActions: ["release_signoff"],
    currentStatus: "available",
    maxAutonomousLevel: 3,
    canModifyProduction: false,
    canTriggerRollback: false,
    canApproveHighRisk: false,
    canEditUI: false,
    canEditCoreRuntime: false,
    riskLimit: "HIGH",
  },
  CURSOR_UI_AGENT: {
    id: "CURSOR_UI_AGENT",
    role: "Human-supervised UI editing",
    capabilities: ["ui_editing", "visual_iteration", "human_supervised_refinement"],
    blockedActions: ["production_deploy", "rollback_execution", "env_access", "core_runtime_rewrite"],
    approvalRequiredActions: ["high_risk_ui_effect", "app_page_edit", "globals_css_edit"],
    currentStatus: "available",
    maxAutonomousLevel: 2,
    canModifyProduction: false,
    canTriggerRollback: false,
    canApproveHighRisk: false,
    canEditUI: true,
    canEditCoreRuntime: false,
    riskLimit: "MEDIUM",
  },
  SELF_HEAL_AGENT: {
    id: "SELF_HEAL_AGENT",
    role: "Failure classification and recovery recommendation",
    capabilities: ["failure_parse", "self_heal_dry_run", "rollback_candidate_recommendation", "runtime_error_classification"],
    blockedActions: ["production_deploy", "rollback_execution", "env_access", "destructive_command"],
    approvalRequiredActions: ["critical_runtime_fix", "rollback_recommendation_acceptance"],
    currentStatus: "available",
    maxAutonomousLevel: 4,
    canModifyProduction: false,
    canTriggerRollback: false,
    canApproveHighRisk: false,
    canEditUI: false,
    canEditCoreRuntime: false,
    riskLimit: "MEDIUM",
  },
  RELEASE_MANAGER_AGENT: {
    id: "RELEASE_MANAGER_AGENT",
    role: "Release readiness, build/risk/approval verification",
    capabilities: ["build_result_review", "release_readiness_report", "rollback_candidate_recording", "production_safety_check"],
    blockedActions: ["production_deploy", "rollback_execution", "env_access", "domain_change"],
    approvalRequiredActions: ["production_release", "rollback_request", "alias_change"],
    currentStatus: "available",
    maxAutonomousLevel: 3,
    canModifyProduction: false,
    canTriggerRollback: false,
    canApproveHighRisk: false,
    canEditUI: false,
    canEditCoreRuntime: false,
    riskLimit: "HIGH",
  },
  WATCHER_AGENT: {
    id: "WATCHER_AGENT",
    role: "Markdown memory watch and loop trigger",
    capabilities: ["file_watch", "loop_trigger", "bridge_trigger", "event_log"],
    blockedActions: ["production_deploy", "rollback_execution", "env_access", "code_editing"],
    approvalRequiredActions: ["high_frequency_automation_change"],
    currentStatus: "available",
    maxAutonomousLevel: 3,
    canModifyProduction: false,
    canTriggerRollback: false,
    canApproveHighRisk: false,
    canEditUI: false,
    canEditCoreRuntime: false,
    riskLimit: "LOW",
  },
  HUMAN_VISION_OWNER: {
    id: "HUMAN_VISION_OWNER",
    role: "Final vision, approval, production, security, and release authority",
    capabilities: ["final_approval", "production_decision", "rollback_decision", "vision_direction", "security_decision"],
    blockedActions: [],
    approvalRequiredActions: [],
    currentStatus: "human-only",
    maxAutonomousLevel: 5,
    canModifyProduction: true,
    canTriggerRollback: true,
    canApproveHighRisk: true,
    canEditUI: true,
    canEditCoreRuntime: true,
    riskLimit: "CRITICAL",
  },
};

export function listAgents(): RuntimeAgent[] {
  return Object.values(AGENT_REGISTRY);
}

export function findCapableAgents(capability: string): RuntimeAgent[] {
  return listAgents().filter((agent) => agent.capabilities.includes(capability));
}

export function getAgent(agentId: AgentId): RuntimeAgent {
  return AGENT_REGISTRY[agentId];
}
