'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  FileText, Plus, Download, Printer, Share2, BrainCircuit,
  Clock, Users, Film, Shield, Search, Sparkles, CheckCircle,
  AlertCircle, ChevronRight, X, Lock, Layers,
} from 'lucide-react';
import { mockReport, mockCases } from '@/lib/mockData';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { cn, formatTimestamp, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';

const ForensicReportGenerator = dynamic(
  () => import('@/components/reports/ForensicReportGenerator').then(m => ({ default: m.ForensicReportGenerator })),
  { ssr: false, loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground font-mono">Loading Report Generator…</p>
      </div>
    </div>
  )}
);

const REPORTS = [
  { id:'rpt-jack', caseId:'case-jack', caseNumber:'PAN-1888-0001', type:'comprehensive', title:'AI Forensic Report – Jack the Ripper', status:'reviewed', generatedAt:'2026-06-30T10:00:00Z', generatedBy:'AI (Gemini Pro)', reviewedBy:'Det. Sarah Kim', pages:38, version:3 },
  { id:'rpt-cooper', caseId:'case-cooper', caseNumber:'PAN-1971-0001', type:'suspect', title:'Suspect Analysis – D.B. Cooper NORJAK', status:'generated', generatedAt:'2026-06-29T14:00:00Z', generatedBy:'AI (Gemini Pro)', pages:24, version:2 },
  { id:'rpt-zodiac', caseId:'case-zodiac', caseNumber:'PAN-1969-0001', type:'timeline', title:'Event Timeline – Zodiac Killer Cases', status:'draft', generatedAt:'2026-06-28T09:00:00Z', generatedBy:'AI (Gemini Pro)', pages:18, version:1 },
  { id:'rpt-001', caseId:'case-001', caseNumber:'PAN-2026-0047', type:'comprehensive', title:'Forensic Intelligence Report – Central Station Robbery', status:'final', generatedAt:'2026-06-30T09:00:00Z', generatedBy:'AI (Gemini Pro)', reviewedBy:'Det. Sarah Kim', pages:24, version:2 },
];

const TYPE_CFG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  comprehensive: { icon: FileText, color:'text-accent',   label:'Comprehensive' },
  timeline:      { icon: Clock,    color:'text-primary',  label:'Timeline'      },
  suspect:       { icon: Users,    color:'text-warning',  label:'Suspect'       },
  evidence:      { icon: Film,     color:'text-success',  label:'Evidence'      },
  incident:      { icon: Shield,   color:'text-danger',   label:'Incident'      },
};

function handlePrint(title: string) {
  toast.promise(new Promise(r => setTimeout(r, 1500)), {
    loading: 'Preparing print layout…',
    success: 'Ready to print',
    error: 'Print failed',
  });
}

function handleDownload(title: string) {
  toast.promise(
    new Promise<void>((resolve) => {
      setTimeout(() => {
        // Generate a simple text blob as stand-in for PDF
        const content = `PANOPTICON FORENSIC INTELLIGENCE REPORT\n${'='.repeat(50)}\n\n${title}\nGenerated: ${new Date().toLocaleString()}\nClassification: RESTRICTED – Law Enforcement Use Only\n\n[Full report content would be rendered here with all evidence, timeline and suspect data]\n`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\s+/g,'_')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      }, 1200);
    }),
    { loading:'Generating report…', success:'Report downloaded', error:'Download failed' }
  );
}

export default function ReportsPage() {
  const [selected, setSelected]   = useState(REPORTS[3]);
  const [search,   setSearch]     = useState('');
  const [showGen,  setShowGen]    = useState(false);
  const [genPct,   setGenPct]     = useState(0);
  const [genRunning, setGenRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'reports' | 'generator'>('reports');

  const filtered = REPORTS.filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.caseNumber.toLowerCase().includes(search.toLowerCase())
  );

  const startGenerate = () => {
    setShowGen(false);
    setGenRunning(true);
    setGenPct(0);
    const iv = setInterval(() => {
      setGenPct(p => {
        if (p >= 100) { clearInterval(iv); setGenRunning(false); toast.success('Report generated'); return 100; }
        return p + 4;
      });
    }, 120);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left list */}
      <div className="w-80 shrink-0 flex flex-col overflow-hidden" style={{ background:'rgba(4,6,14,0.6)', borderRight:'1px solid rgba(255,255,255,0.06)' }}>
        <div className="p-4" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-sm font-bold">Reports</h1>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setActiveTab('generator')}
                className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                  activeTab === 'generator' ? 'bg-accent/15 text-accent border-accent/30' : 'border-border text-muted-foreground hover:text-foreground')}>
                <Layers className="w-3.5 h-3.5" /> AI Gen
              </button>
              <button onClick={() => setShowGen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                style={{ background:'linear-gradient(135deg,#00b4d8,#1565c0)', color:'white' }}>
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>
          </div>
          {/* Tab bar */}
          <div className="flex rounded-lg overflow-hidden border border-border mb-3">
            {(['reports', 'generator'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={cn('flex-1 py-1.5 text-2xs font-semibold capitalize transition-colors',
                  activeTab === t ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:text-foreground')}>
                {t === 'generator' ? '⚡ AI Generator' : '📄 Library'}
              </button>
            ))}
          </div>
          {activeTab === 'reports' && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports…"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }} />
            </div>
          )}
        </div>

        {/* Generating bar */}
        <AnimatePresence>
          {genRunning && (
            <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
              className="overflow-hidden mx-3 my-2 p-3 rounded-xl"
              style={{ background:'rgba(0,180,216,0.07)', border:'1px solid rgba(0,180,216,0.2)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <BrainCircuit className="w-3.5 h-3.5 text-accent animate-pulse" />
                <span className="text-xs font-semibold text-accent">Generating report…</span>
                <span className="ml-auto text-xs font-mono text-accent/70">{genPct}%</span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <motion.div className="h-full rounded-full bg-accent" animate={{ width:`${genPct}%` }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Report list */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {activeTab === 'reports' && filtered.map(r => {
            const cfg = TYPE_CFG[r.type] || TYPE_CFG.comprehensive;
            const Icon = cfg.icon;
            const isSelected = selected?.id === r.id;
            return (
              <button key={r.id} onClick={() => setSelected(r)}
                className={cn('w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all border-l-2', isSelected ? 'bg-accent/8 border-l-accent' : 'border-l-transparent hover:bg-white/[0.025]')}
                style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', isSelected ? 'bg-accent/15' : 'bg-white/5')}>
                  <Icon className={cn('w-4 h-4', cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-2xs font-mono text-muted-foreground/50">{r.caseNumber}</span>
                    <StatusBadge status={r.status as any} className="text-2xs" />
                  </div>
                  <p className="text-xs font-semibold line-clamp-2 leading-relaxed">{r.title}</p>
                  <p className="text-2xs text-muted-foreground mt-1">{r.pages}p · v{r.version} · {formatRelativeTime(r.generatedAt)}</p>
                </div>
              </button>
            );
          })}
          {activeTab === 'generator' && (
            <div className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Configure and generate dataset-backed forensic reports with AI analysis.</p>
              <div className="space-y-1.5">
                {[
                  { label: 'MOT17 Tracking', desc: 'Pedestrian movement validation' },
                  { label: 'Market-1501 ReID', desc: 'Cross-camera identity matching' },
                  { label: 'COCO Detection', desc: 'Weapon & object analysis' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 p-2.5 rounded-lg border border-border"
                    style={{ background: 'rgba(0,180,216,0.04)' }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    <div>
                      <p className="text-2xs font-semibold text-accent">{item.label}</p>
                      <p className="text-2xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Generator OR Report viewer */}
      {activeTab === 'generator' ? (
        <div className="flex-1 overflow-hidden">
          <ForensicReportGenerator />
        </div>
      ) : selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0"
            style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(4,6,14,0.5)', backdropFilter:'blur(12px)' }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground/50">{selected.caseNumber}</span>
                <StatusBadge status={selected.status as any} />
                <span className="badge-info text-2xs capitalize">{TYPE_CFG[selected.type]?.label}</span>
              </div>
              <h2 className="text-base font-bold">{selected.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generated {formatTimestamp(selected.generatedAt, 'dd MMM yyyy HH:mm')} by {selected.generatedBy}
                {selected.reviewedBy && ` · Reviewed by ${selected.reviewedBy}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handlePrint(selected.title)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border text-muted-foreground hover:text-foreground"
                style={{ border:'1px solid rgba(255,255,255,0.08)' }}>
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button onClick={() => handleDownload(selected.title)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background:'linear-gradient(135deg,#00b4d8,#1565c0)', color:'white', boxShadow:'0 4px 16px rgba(0,180,216,0.35)' }}>
                <Download className="w-4 h-4" /> Download Report
              </button>
            </div>
          </div>

          {/* Document body */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto space-y-8">
              {/* Cover */}
              <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                className="rounded-2xl p-8" style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:'linear-gradient(135deg,#00b4d8,#1565c0)' }}>
                        <Shield className="w-4.5 h-4.5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold tracking-widest text-gradient-cyan">PANOPTICON</p>
                        <p className="text-2xs text-muted-foreground/50 tracking-widest">FORENSIC INTELLIGENCE</p>
                      </div>
                    </div>
                    <h1 className="text-2xl font-bold mb-2">{selected.title}</h1>
                    <p className="text-sm text-muted-foreground">Case {selected.caseNumber} · {TYPE_CFG[selected.type]?.label} Report</p>
                  </div>
                  <div className="text-right shrink-0 ml-6">
                    <p className="text-2xs text-muted-foreground/50 uppercase tracking-wider mb-1">Classification</p>
                    <p className="text-sm font-bold text-danger flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> RESTRICTED</p>
                    <p className="text-2xs text-muted-foreground/50 uppercase tracking-wider mt-3 mb-1">Report ID</p>
                    <p className="text-xs font-mono">{selected.id.toUpperCase()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 pt-5" style={{ borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                  {[
                    ['Generated', formatTimestamp(selected.generatedAt, 'dd MMM yyyy')],
                    ['Version',   `v${selected.version}`],
                    ['Pages',     String(selected.pages)],
                    ['Status',    selected.status.toUpperCase()],
                  ].map(([l,v]) => (
                    <div key={l}>
                      <p className="text-2xs text-muted-foreground/50 uppercase tracking-wider">{l}</p>
                      <p className="text-sm font-bold mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Sections */}
              {[
                { n:'01', t:'Executive Summary', content: mockReport.summary + '\n\nThis report presents AI-assisted forensic analysis of all available evidence. Cross-camera re-identification algorithms have been applied where applicable. Confidence scores are assigned to all findings.' },
                { n:'02', t:'Event Timeline Reconstruction', isTimeline: true },
                { n:'03', t:'Suspect Profiles', isSuspects: true },
                { n:'04', t:'Evidence Inventory', isEvidence: true },
                { n:'05', t:'Conclusions & Recommendations', isConclusions: true },
              ].map((sec, i) => (
                <motion.section key={sec.n} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: 0.1 + i*0.07 }}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-mono font-bold text-accent/50">{sec.n}</span>
                    <h3 className="text-base font-bold">{sec.t}</h3>
                    <div className="flex-1 h-px" style={{ background:'rgba(255,255,255,0.07)' }} />
                  </div>

                  {sec.content && (
                    <p className="text-sm text-muted-foreground leading-7">{sec.content}</p>
                  )}

                  {sec.isTimeline && (
                    <div className="space-y-3">
                      {[
                        { t:'14:28:14', e:'Two suspects enter Central Station via south entrance.', cam:'CAM-STN-002', conf:91, sig:'high' },
                        { t:'14:31:48', e:'Suspects approach Platform 4. Cross-camera confirmation.', cam:'CAM-STN-004', conf:95, sig:'high' },
                        { t:'14:32:14', e:'Robbery initiated. Firearm detected in suspect Alpha\'s hand.', cam:'CAM-STN-004', conf:89, sig:'critical' },
                        { t:'14:33:01', e:'Suspects flee via north emergency exit with victim\'s property.', cam:'CAM-STN-004', conf:97, sig:'critical' },
                      ].map((item,idx) => (
                        <div key={idx} className="flex gap-4 p-4 rounded-xl" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                          <span className="text-sm font-mono font-bold text-accent shrink-0">{item.t}</span>
                          <div className="flex-1">
                            <p className="text-sm">{item.e}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-2xs font-mono text-muted-foreground/60">{item.cam}</span>
                              <ConfidenceBadge score={item.conf} size="sm" />
                              <span className={cn('text-2xs font-semibold capitalize', item.sig==='critical'?'text-danger':'text-warning')}>{item.sig}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {sec.isSuspects && (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { l:'Suspect Alpha', r:'Primary Actor', conf:94, attr:'Male, ~30-35 yrs, dark jacket, baseball cap. Clear facial capture at 14:32:28.', cams:2, first:'14:28:14', last:'14:33:01' },
                        { l:'Suspect Beta',  r:'Lookout',       conf:88, attr:'Male, ~25-30 yrs, grey hoodie, jeans, white sneakers. Maintained lookout position.', cams:2, first:'14:28:14', last:'14:33:01' },
                      ].map((s,idx) => (
                        <div key={idx} className="p-4 rounded-xl" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                          <div className="flex justify-between mb-2">
                            <div><p className="text-sm font-bold">{s.l}</p><span className="badge-pending text-2xs">{s.r}</span></div>
                            <ConfidenceBadge score={s.conf} showBar />
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">{s.attr}</p>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {[['First',s.first],['Last',s.last],['Cameras',String(s.cams)]].map(([k,v])=>(
                              <div key={k}><p className="text-2xs text-muted-foreground/60">{k}</p><p className="font-mono font-semibold">{v}</p></div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {sec.isEvidence && (
                    <div className="overflow-hidden rounded-xl" style={{ border:'1px solid rgba(255,255,255,0.07)' }}>
                      <table className="w-full text-sm">
                        <thead><tr style={{ borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.03)' }}>
                          {['ID','Description','Type','Duration','Status','AI'].map(h=>(
                            <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold text-muted-foreground/60 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {[
                            { id:'EV-001', d:'Station Camera 4 – Platform 4', t:'Video',   dur:'30:00', s:'processed', c:92 },
                            { id:'EV-002', d:'Station Camera 2 – Concourse', t:'Video',    dur:'30:00', s:'processed', c:88 },
                            { id:'EV-003', d:'Officer Rodriguez Body Camera', t:'Body Cam', dur:'15:00', s:'processed', c:97 },
                          ].map(ev=>(
                            <tr key={ev.id} className="data-row">
                              <td className="px-4 py-3 text-xs font-mono text-muted-foreground/60">{ev.id}</td>
                              <td className="px-4 py-3 text-xs">{ev.d}</td>
                              <td className="px-4 py-3 text-xs">{ev.t}</td>
                              <td className="px-4 py-3 text-xs font-mono">{ev.dur}</td>
                              <td className="px-4 py-3"><StatusBadge status={ev.s as any} /></td>
                              <td className="px-4 py-3"><ConfidenceBadge score={ev.c} size="sm" showLabel={false} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {sec.isConclusions && (
                    <div className="space-y-3">
                      {[
                        { ok:true,  t:'Two suspects confirmed via cross-camera re-identification (94% and 88% confidence).' },
                        { ok:true,  t:'Complete movement reconstruction from station arrival to escape route.' },
                        { ok:true,  t:'Firearm detection corroborated across two independent camera angles at 14:32:14.' },
                        { ok:false, t:'Facial biometric comparison pending — extended camera network access requested.' },
                      ].map((c,idx)=>(
                        <div key={idx} className="flex items-start gap-3">
                          {c.ok ? <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />}
                          <p className="text-sm text-muted-foreground leading-relaxed">{c.t}</p>
                        </div>
                      ))}
                      <div className="mt-4 p-4 rounded-xl" style={{ background:'rgba(0,180,216,0.06)', border:'1px solid rgba(0,180,216,0.15)' }}>
                        <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-accent" /><span className="text-sm font-semibold">AI Confidence Summary</span></div>
                        <p className="text-sm text-muted-foreground">Overall case reconstruction: <strong className="text-foreground">87%</strong>. Timeline continuity: <strong className="text-foreground">High</strong>. Suspect certainty: <strong className="text-foreground">High</strong>.</p>
                      </div>
                    </div>
                  )}
                </motion.section>
              ))}

              {/* Footer */}
              <div className="pt-6 flex justify-between text-2xs text-muted-foreground/40 font-mono" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                <span>PANOPTICON · {selected.id.toUpperCase()}</span>
                <span>RESTRICTED · Law Enforcement Use Only</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center"><FileText className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Select a report</p></div>
        </div>
      )}      {/* Generate modal */}
      <AnimatePresence>
        {showGen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)' }}>
            <motion.div initial={{ opacity:0, scale:0.97 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.97 }}
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{ background:'rgba(5,8,18,0.97)', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 24px 80px rgba(0,0,0,0.8)' }}>
              <div className="flex items-center gap-3 p-6" style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                <BrainCircuit className="w-5 h-5 text-accent" />
                <div><h2 className="text-base font-bold">Generate AI Report</h2><p className="text-xs text-muted-foreground">Select case and report type</p></div>
                <button onClick={() => setShowGen(false)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Case</label>
                  <select className="w-full mt-1.5 px-3.5 py-2.5 text-sm rounded-xl text-foreground focus:outline-none cursor-pointer" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)' }}>
                    {mockCases.map(c => <option key={c.id} value={c.id} style={{ background:'#0d1526' }}>{c.caseNumber} – {c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Report Type</label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {Object.entries(TYPE_CFG).map(([type, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <label key={type} className="flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-colors hover:bg-white/5" style={{ border:'1px solid rgba(255,255,255,0.07)' }}>
                          <input type="radio" name="rtype" value={type} defaultChecked={type==='comprehensive'} className="accent-blue-500" />
                          <Icon className={cn('w-4 h-4', cfg.color)} />
                          <span className="text-xs font-medium">{cfg.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 p-6" style={{ borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                <button onClick={() => setShowGen(false)} className="flex-1 py-2.5 rounded-xl text-sm text-muted-foreground border border-border hover:text-foreground transition-colors">Cancel</button>
                <button onClick={startGenerate}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:'linear-gradient(135deg,#00b4d8,#1565c0)', color:'white' }}>
                  <Sparkles className="w-4 h-4" /> Generate
                </button>
              </div>
            </motion.div>
            <div className="absolute inset-0 -z-10" onClick={() => setShowGen(false)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
