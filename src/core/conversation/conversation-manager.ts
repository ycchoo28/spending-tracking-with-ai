/**
 * Conversation Manager
 *
 * Handles conversation lifecycle management including creation,
 * expiration, and cleanup.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface Conversation {
  id: string;
  user_id: string;
  chat_id: number;
  status: "active" | "completed" | "expired" | "cancelled";
  created_at: string;
  last_activity_at: string;
  turn_count: number;
  active_sub_agent: string | null;
  metadata: Record<string, any> | null;
}

export class ConversationManager {
  private supabase: SupabaseClient;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private expirationHours: number;

  constructor(expirationHours: number = 24) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required"
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.expirationHours = expirationHours;
  }

  /**
   * Creates a new conversation
   */
  async createConversation(
    conversationId: string,
    userId: string,
    chatId: number,
    metadata?: Record<string, any>
  ): Promise<Conversation> {
    const { data, error } = await this.supabase
      .from("conversations")
      .insert({
        id: conversationId,
        user_id: userId,
        chat_id: chatId,
        status: "active",
        turn_count: 0,
        metadata: metadata || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return data;
  }

  /**
   * Updates conversation activity timestamp
   */
  async updateActivity(conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .from("conversations")
      .update({
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (error) {
      console.error(`Failed to update conversation activity: ${error.message}`);
    }
  }

  /**
   * Increments turn count for a conversation
   */
  async incrementTurnCount(conversationId: string): Promise<void> {
    const { error } = await this.supabase.rpc("increment_turn_count", {
      conversation_id: conversationId,
    });

    if (error) {
      // Fallback if RPC doesn't exist
      const { data: conversation } = await this.supabase
        .from("conversations")
        .select("turn_count")
        .eq("id", conversationId)
        .single();

      if (conversation) {
        await this.supabase
          .from("conversations")
          .update({ turn_count: conversation.turn_count + 1 })
          .eq("id", conversationId);
      }
    }
  }

  /**
   * Updates the active sub-agent for a conversation
   */
  async updateActiveSubAgent(
    conversationId: string,
    subAgent: string | null
  ): Promise<void> {
    const { error } = await this.supabase
      .from("conversations")
      .update({ active_sub_agent: subAgent })
      .eq("id", conversationId);

    if (error) {
      console.error(`Failed to update active sub-agent: ${error.message}`);
    }
  }

  /**
   * Updates conversation status
   */
  async updateStatus(
    conversationId: string,
    status: "active" | "completed" | "expired" | "cancelled"
  ): Promise<void> {
    const { error } = await this.supabase
      .from("conversations")
      .update({ status })
      .eq("id", conversationId);

    if (error) {
      throw new Error(`Failed to update conversation status: ${error.message}`);
    }
  }

  /**
   * Gets a conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    const { data, error } = await this.supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Gets active conversations for a user
   */
  async getActiveConversations(userId: string): Promise<Conversation[]> {
    const { data, error } = await this.supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("last_activity_at", { ascending: false });

    if (error) {
      console.error(`Failed to get active conversations: ${error.message}`);
      return [];
    }

    return data || [];
  }

  /**
   * Expires inactive conversations
   */
  async expireInactiveConversations(): Promise<number> {
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() - this.expirationHours);

    const { data, error } = await this.supabase
      .from("conversations")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("last_activity_at", expirationTime.toISOString())
      .select();

    if (error) {
      console.error(`Failed to expire conversations: ${error.message}`);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Cleans up expired checkpoints
   */
  async cleanupExpiredCheckpoints(): Promise<number> {
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() - this.expirationHours);

    const { data, error } = await this.supabase
      .from("checkpoints")
      .delete()
      .lt("created_at", expirationTime.toISOString())
      .select();

    if (error) {
      console.error(`Failed to cleanup checkpoints: ${error.message}`);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Starts automatic cleanup job
   */
  startCleanupJob(intervalHours: number = 6): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;

    this.cleanupInterval = setInterval(async () => {
      console.log("Running conversation cleanup job...");

      try {
        const expiredCount = await this.expireInactiveConversations();
        console.log(`Expired ${expiredCount} inactive conversations`);
      } catch (error) {
        console.error(
          "Failed to expire conversations:",
          error instanceof Error ? error.message : error
        );
      }

      try {
        const checkpointCount = await this.cleanupExpiredCheckpoints();
        console.log(`Cleaned up ${checkpointCount} expired checkpoints`);
      } catch (error) {
        console.error(
          "Failed to cleanup checkpoints:",
          error instanceof Error ? error.message : error
        );
      }
    }, intervalMs);

    // Run immediately on start (with error handling)
    this.expireInactiveConversations().catch((err) =>
      console.error(
        "Failed to expire conversations:",
        err instanceof Error ? err.message : err
      )
    );
    this.cleanupExpiredCheckpoints().catch((err) =>
      console.error(
        "Failed to cleanup checkpoints:",
        err instanceof Error ? err.message : err
      )
    );
  }

  /**
   * Stops the cleanup job
   */
  stopCleanupJob(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
