'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit,
  Send,
  X,
  Sparkles,
  Film,
  Users,
  Clock,
  Loader2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Maximize2,
} from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { casesAPI, evidenceAPI, aiAPI } from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { ChatMessage } from '@/types';

const suggestedQueries = [
  'Who touched the backpack?',
  'Show suspect movements before the incident',
  'When did the weapon first appear?',
  'Cross-reference suspects across cameras',
  'Generate timeline of events',
  'Identify all persons in Platform 4',
];

export function AiPanel() {
  const { setAiPanelOpen, selectedCaseId } = useUIStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Use a stable session ID per panel open
  const sessionId = useRef(`session-${Date.now()}`);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const caseId = selectedCaseId ?? 'case-001';
      const { data: result } = await aiAPI.copilot(text, caseId, { sessionId: sessionId.current });
      const aiMsg: ChatMessage = {
        id: result.id,
        role: 'assistant',
        content: result.content,
        timestamp: result.timestamp,
        confidence: result.confidence ?? undefined,
        processingTime: result.processing_time ?? undefined,
        evidenceRefs: result.evidence_refs ?? [],
        suspectRefs: result.suspect_refs ?? [],
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'I was unable to process your request. Please check that the backend is running and try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#060b17]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <BrainCircuit className="w-4 h-4 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-[#060b17]" />
          </div>
          <div>
            <p className="text-sm font-semibold">AI Forensic Copilot</p>
            <p className="text-2xs text-success/70">Online · Gemini Pro</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setAiPanelOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {/* Welcome message */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-primary/20 border border-accent/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-sm font-semibold mb-1">AI Forensic Copilot</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Ask investigative questions about evidence, suspects, and timelines. I analyze all processed footage in this case.
            </p>
          </motion.div>
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-3"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center shrink-0 mt-0.5">
                <BrainCircuit className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm bg-surface border border-border">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-accent"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground ml-1">Analyzing evidence...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested queries */}
      {messages.length < 2 && (
        <div className="px-4 pb-3 shrink-0">
          <p className="text-2xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
            Suggested queries
          </p>
          <div className="flex flex-col gap-1">
            {suggestedQueries.slice(0, 3).map((q) => (
              <button
                key={q}
                onClick={() => {
                  setInput(q);
                  inputRef.current?.focus();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors border border-border/50 hover:border-accent/30"
              >
                <Sparkles className="w-3 h-3 text-accent/60 shrink-0" />
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-border shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about suspects, evidence, timelines..."
              rows={1}
              className="w-full px-3 py-2.5 text-sm bg-surface border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 resize-none leading-relaxed max-h-32 overflow-y-auto no-scrollbar transition-colors"
              style={{ minHeight: '42px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 shrink-0',
              input.trim() && !isTyping
                ? 'bg-accent text-accent-foreground hover:bg-accent-glow shadow-glow-sm'
                : 'bg-surface border border-border text-muted-foreground cursor-not-allowed'
            )}
          >
            {isTyping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-2xs text-muted-foreground/50 mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message: msg }: { message: ChatMessage }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center shrink-0 mt-0.5">
          <BrainCircuit className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      <div className={cn('flex flex-col gap-1.5 max-w-[88%]', isUser && 'items-end')}>
        {/* Bubble */}
        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-accent/15 border border-accent/25 text-foreground rounded-tr-sm'
              : 'bg-surface border border-border text-foreground rounded-tl-sm'
          )}
        >
          {msg.content.split('\n').map((line, i) => {
            // Bold rendering
            const parts = line.split(/(\*\*[^*]+\*\*)/g);
            return (
              <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
                {parts.map((part, j) =>
                  part.startsWith('**') && part.endsWith('**') ? (
                    <strong key={j} className="font-semibold text-foreground">
                      {part.slice(2, -2)}
                    </strong>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </p>
            );
          })}
        </div>

        {/* Evidence refs */}
        {msg.evidenceRefs && msg.evidenceRefs.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {msg.evidenceRefs.map((ref) => (
              <span
                key={ref}
                className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 cursor-pointer hover:bg-primary/15 transition-colors"
              >
                <Film className="w-2.5 h-2.5" />
                {ref}
              </span>
            ))}
            {msg.suspectRefs?.map((ref) => (
              <span
                key={ref}
                className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20"
              >
                <Users className="w-2.5 h-2.5" />
                {ref}
              </span>
            ))}
            {msg.timelineRefs?.map((ref) => (
              <span
                key={ref}
                className="flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20"
              >
                <Clock className="w-2.5 h-2.5" />
                {ref}
              </span>
            ))}
          </div>
        )}

        {/* Meta row */}
        <div className={cn('flex items-center gap-3', isUser && 'flex-row-reverse')}>
          <span className="text-2xs text-muted-foreground/50">
            {formatRelativeTime(msg.timestamp)}
          </span>
          {msg.confidence && (
            <span className="text-2xs text-success/60">
              {msg.confidence}% confidence
            </span>
          )}
          {msg.processingTime && (
            <span className="text-2xs text-muted-foreground/40">
              {(msg.processingTime / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        {/* AI message actions */}
        {!isUser && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              title="Copy"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-success transition-colors" title="Helpful">
              <ThumbsUp className="w-3 h-3" />
            </button>
            <button className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-danger transition-colors" title="Not helpful">
              <ThumbsDown className="w-3 h-3" />
            </button>
            <button className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors" title="Regenerate">
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// End of AiPanel module
