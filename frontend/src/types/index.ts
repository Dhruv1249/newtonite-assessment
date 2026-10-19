/**
 * Domain entity interfaces and type contracts for OpFlow frontend.
 */

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: "admin" | "lead" | "member" | "viewer";
  joined_at: string;
  user?: User;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  workflow_id: string;
  created_at: string;
  member_count: number;
  user_role?: "admin" | "lead" | "member" | "viewer";
}

export interface WorkflowState {
  id: string;
  label: string;
  type: "initial" | "active" | "terminal";
}

export interface WorkflowTransition {
  from: string;
  to: string;
  required_roles: string[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  is_default: boolean;
  created_at: string;
}

export interface DuplicateMatch {
  item_id: string;
  title: string;
  status: string;
  similarity_score: number;
}

export interface AssigneeRecommendation {
  user_id: string;
  display_name: string;
  confidence_score: number;
  reasoning: string;
}

export interface AIMetadata {
  suggested_priority?: "critical" | "high" | "medium" | "low";
  suggested_category?: string;
  summary?: string;
  suggested_next_steps?: string[];
  potential_duplicates?: DuplicateMatch[];
  recommended_assignees?: AssigneeRecommendation[];
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  team_id: string;
  team_name?: string;
  created_by_id: string;
  assignee_id: string | null;
  status: string;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  version: number;
  ai_metadata?: AIMetadata | null;
  created_at: string;
  updated_at: string;
  team?: Team;
  creator?: User;
  assignee?: User | null;
}

export interface WorkItemListResponse {
  items: WorkItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Comment {
  id: string;
  item_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: User;
}

export interface ActivityLog {
  id: string;
  item_id: string;
  user_id: string;
  action_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  actor?: User;
}

export interface SemanticSearchResultItem {
  item: WorkItem;
  similarity_score: number;
}

export interface SemanticSearchResponse {
  query: string;
  total_results: number;
  results: SemanticSearchResultItem[];
}

export interface DashboardStats {
  total_active_items: number;
  critical_items_count: number;
  unassigned_items_count: number;
  in_review_items_count: number;
  items_by_priority: Record<string, number>;
  items_by_status: Record<string, number>;
}
