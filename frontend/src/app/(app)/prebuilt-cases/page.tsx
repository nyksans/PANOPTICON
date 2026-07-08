'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Building, Calendar, Shield, Users, ArrowRight, ShieldCheck, Database } from 'lucide-react';
import { indianCases } from '@/lib/indianCases';
import type { IndianCase } from '@/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';

export default function PrebuiltCasesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState<string>('All');

  const uniqueStates = ['All', ...Array.from(new Set(indianCases.map(c => c.metadata.state)))];

  const filteredCases = indianCases.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.metadata.firNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesState = selectedState === 'All' || c.metadata.state === selectedState;
    return matchesSearch && matchesState;
  });

  return (
    <div className="flex-1 p-6 lg:p-10 flex flex-col min-h-0 bg-background/50 overflow-y-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">Prebuilt Case Library</h1>
            <span className="border border-accent text-accent bg-accent/10 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
              India Edition
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Explore 20 highly realistic, synthetic investigation scenarios designed specifically for Indian law enforcement contexts. 
            All cases contain complete metadata, simulated CCTV intelligence, FIR numbers, and suspect profiles.
          </p>
        </div>
      </div>

      {/* Filters section */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search by Title or FIR Number..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {uniqueStates.map(state => (
            <button
              key={state}
              onClick={() => setSelectedState(state)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                selectedState === state 
                  ? "bg-accent text-accent-foreground border-accent" 
                  : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              )}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      {/* Cases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {filteredCases.map((c, idx) => (
          <CaseCard key={c.id} c={c} index={idx} />
        ))}
        {filteredCases.length === 0 && (
          <div className="col-span-full py-20 text-center text-muted-foreground flex flex-col items-center justify-center">
            <Database className="w-12 h-12 mb-4 opacity-20" />
            <p>No cases found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CaseCard({ c, index }: { c: IndianCase, index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group relative flex flex-col rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-accent/30 transition-colors"
    >
      <div className="p-5 flex-1 flex flex-col">
        {/* Top bar: FIR and Status */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <span className="text-xs font-mono text-muted-foreground mb-1">{c.metadata.firNumber}</span>
            <StatusBadge status={c.status} />
          </div>
          <ConfidenceBadge score={c.confidenceScore} />
        </div>

        {/* Title and Category */}
        <h3 className="font-bold text-lg leading-tight mb-2 group-hover:text-accent transition-colors line-clamp-2">
          {c.title}
        </h3>
        <p className="text-xs font-medium text-destructive mb-4 uppercase tracking-wider">{c.category}</p>

        {/* Location & IO */}
        <div className="space-y-2 mb-6 flex-1">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="line-clamp-1">{c.metadata.policeStation}, {c.metadata.district}</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="line-clamp-1">{c.metadata.leadIO}</span>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="flex gap-4 p-3 rounded-lg bg-black/40 border border-white/5 mb-4">
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Cameras</span>
            <span className="text-lg font-mono text-white">{c.metadata.cctvCameras?.length || 0}</span>
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Suspects</span>
            <span className="text-lg font-mono text-white">{c.metadata.suspectProfiles?.length || 0}</span>
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Progress</span>
            <span className="text-lg font-mono text-accent">{c.metadata.investigationProgress || 0}%</span>
          </div>
        </div>

        {/* Action Button */}
        <Link href={`/cases/${c.id}`} className="w-full">
          <Button variant="secondary" className="w-full justify-between group-hover:bg-accent group-hover:text-accent-foreground transition-all">
            Load Case Workspace
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
