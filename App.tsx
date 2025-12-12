import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './components/Icon';
import { optimizePrompt, testGeneratedPrompt, analyzeImage } from './services/geminiService';
import { OptimizationFramework, Tone, PromptConfig, PromptMode } from './types';

const App: React.FC = () => {
  // State
  const [rawInput, setRawInput] = useState('');
  const [optimizedOutput, setOptimizedOutput] = useState('');
  const [testResult, setTestResult] = useState('');
  
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  
  const [activeTab, setActiveTab] = useState<'editor' | 'test'>('editor');
  const [copySuccess, setCopySuccess] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Save Status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // File Import Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Studio Builder State
  const [inputMode, setInputMode] = useState<'raw' | 'studio'>('raw');
  const [builderTab, setBuilderTab] = useState<1 | 2 | 3>(1);
  const [builderState, setBuilderState] = useState({
    // Tab 1: World
    t1_race: '', t1_costume: '', t1_props: '', t1_period: 'Medieval Era, 13th Century', 
    t1_location: 'Vast Steppe Grasslands', t1_style: 'Epic Historical Film', t1_lighting: 'Cinematic Volumetric Lighting',
    t1_story: '', t1_seed: '',
    // Tab 2: Camera
    t2_framing: 'Wide Shot', t2_movement: 'Static Camera', t2_rig: 'Steadicam Smooth', 
    t2_lens: '35mm Lens', t2_lighting: 'Cinematic Volumetric Lighting', t2_duration: '5', t2_seed: '', t2_story: '',
    // Tab 3: Sequencing
    t3_focus: 'Transition', t3_motion: 'Falcon Aerial Chase', t3_framing: '', 
    t3_direction: '', t3_altitude: '', t3_density: '', t3_atm: 'Battlefield Smoke', 
    t3_strength: '10', t3_duration: '10', t3_seed: ''
  });

  // Image Preview State
  const [viewImage, setViewImage] = useState<string | null>(null);

  // Configuration State
  const [config, setConfig] = useState<PromptConfig>({
    mode: PromptMode.Text,
    framework: OptimizationFramework.COSTAR,
    tone: Tone.Professional,
    includeVariables: false,
    negativeConstraint: 'CGI, 3D render, cartoon, anime, drawing, painting, bad quality',
    aspectRatio: '16:9'
  });

  // LOAD SESSION
  useEffect(() => {
    const saved = localStorage.getItem('promptcraft_session_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.builderState) setBuilderState(prev => ({ ...prev, ...parsed.builderState }));
        if (parsed.config) setConfig(prev => ({ ...prev, ...parsed.config }));
        if (parsed.rawInput) setRawInput(parsed.rawInput);
        if (parsed.optimizedOutput) setOptimizedOutput(parsed.optimizedOutput);
        if (parsed.inputMode) setInputMode(parsed.inputMode);
      } catch (e) {
        console.error("Failed to load session", e);
      }
    }
  }, []);

  // AUTO-SAVE SESSION
  useEffect(() => {
    const timer = setTimeout(() => {
      const session = {
        builderState,
        config,
        rawInput,
        optimizedOutput,
        inputMode
      };
      localStorage.setItem('promptcraft_session_v1', JSON.stringify(session));
      setSaveStatus('saved');
      // Reset status to idle after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000); // Save 1 second after last change

    return () => clearTimeout(timer);
  }, [builderState, config, rawInput, optimizedOutput, inputMode]);

  // Reset/Adjust defaults when mode changes
  useEffect(() => {
    if (config.mode === PromptMode.Video || config.mode === PromptMode.Image) {
      setConfig(prev => ({
        ...prev,
        framework: OptimizationFramework.Visual, // Default to Visual for video/image
        tone: Tone.Cinematic
      }));
      if(config.mode === PromptMode.Video) {
         if (inputMode === 'raw') setInputMode('studio');
      }
    } else {
      setConfig(prev => ({
        ...prev,
        framework: OptimizationFramework.COSTAR,
        tone: Tone.Professional
      }));
      setInputMode('raw');
    }
    setTestResult(''); // Clear old tests on mode switch
    setAnalysisResult('');
  }, [config.mode]);

  // Derived state
  const canOptimize = rawInput.trim().length > 0;
  const canTest = optimizedOutput.trim().length > 0;

  // Handlers
  const manualSave = () => {
    const session = { builderState, config, rawInput, optimizedOutput, inputMode };
    localStorage.setItem('promptcraft_session_v1', JSON.stringify(session));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleExportSession = () => {
    const session = { builderState, config, rawInput, optimizedOutput, inputMode };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `promptcraft_session_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.builderState) setBuilderState(parsed.builderState);
        if (parsed.config) setConfig(parsed.config);
        if (parsed.rawInput) setRawInput(parsed.rawInput);
        if (parsed.optimizedOutput) setOptimizedOutput(parsed.optimizedOutput);
        if (parsed.inputMode) setInputMode(parsed.inputMode);
        alert("Session loaded successfully!");
      } catch (err) {
        alert("Failed to load session file. It might be corrupted.");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const clearSession = () => {
    if(window.confirm("Are you sure you want to clear your current session and reset all fields? This cannot be undone.")) {
      localStorage.removeItem('promptcraft_session_v1');
      window.location.reload();
    }
  };

  const handleOptimize = async () => {
    if (!canOptimize) return;
    setIsOptimizing(true);
    setOptimizedOutput(''); 
    setTestResult(''); 
    setAnalysisResult('');
    
    try {
      const result = await optimizePrompt(rawInput, config);
      setOptimizedOutput(result);
      setActiveTab('editor');
    } catch (err) {
      alert("Failed to optimize prompt. Check console/API key.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleTest = async () => {
    if (!canTest) return;
    setIsTesting(true);
    setAnalysisResult('');
    setActiveTab('test');
    
    if (config.mode === PromptMode.Video) {
      setLoadingMessage("Initializing Veo... This may take 1-2 minutes.");
    } else if (config.mode === PromptMode.Image) {
      setLoadingMessage("Generating Image...");
    } else {
      setLoadingMessage("Gemini is thinking...");
    }
    
    try {
      const result = await testGeneratedPrompt(optimizedOutput, config.mode, config.aspectRatio);
      setTestResult(result);
    } catch (err) {
      console.error(err);
      setTestResult("Error: Could not run the prompt. If using Video, ensure you have selected a Paid API Key.");
    } finally {
      setIsTesting(false);
      setLoadingMessage('');
    }
  };

  const handleAnalyze = async () => {
    if (!testResult || !testResult.startsWith('data:image')) return;
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeImage(testResult, optimizedOutput);
      setAnalysisResult(analysis);
    } catch (err) {
      console.error(err);
      setAnalysisResult("Failed to analyze image.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(optimizedOutput);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const openBilling = () => {
     window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank');
  };

  const openKeySelection = async () => {
     if (window.aistudio) {
       await window.aistudio.openSelectKey();
     }
  };

  // Studio Builder Logic
  const handleBuilderChange = (key: string, value: string) => {
    setBuilderState(prev => ({...prev, [key]: value}));
  };

  const generateFromBuilder = () => {
     let prompt = "";
     const b = builderState;
     const neg = config.negativeConstraint ? ` --no ${config.negativeConstraint}` : '';
     const ar = config.aspectRatio === '16:9' ? '--ar 16:9' : '--ar 9:16';

     if (builderTab === 1) {
       // World & Authenticity
       const parts = [b.t1_style, b.t1_race, b.t1_costume, b.t1_props, b.t1_period, b.t1_location, b.t1_story, b.t1_lighting, "photorealistic, raw style, 8k resolution, highly detailed"];
       prompt = parts.filter(Boolean).join(", ");
       prompt += ` ${ar}`;
       if(b.t1_seed) prompt += ` --seed ${b.t1_seed}`;
     } else if (builderTab === 2) {
       // Cinematography
       const story = b.t2_story || b.t1_story; // Fallback to Tab 1 story
       const parts = ["Cinematic, photorealistic", story, b.t2_framing, b.t2_movement, b.t2_rig, b.t2_lens, b.t2_lighting, "8k resolution, raw footage"];
       prompt = parts.filter(Boolean).join(", ");
       prompt += ` ${ar} ( ${b.t2_duration}s )`;
       if(b.t2_seed) prompt += ` --seed ${b.t2_seed}`;
     } else {
       // Sequencing
       let story = b.t1_story;
       let framing = b.t3_framing || "Wide Shot";
       
       if (b.t3_focus === "Transition") {
         let moveStr = b.t3_motion.toLowerCase();
         if(b.t3_direction) moveStr += ` flying ${b.t3_direction}`;
         story = `Camera follows ${moveStr}, transitioning to ${b.t1_story}`;
         if(!b.t3_framing) framing = "Dynamic POV, Fluid Camera";
       } else if (b.t3_focus === "Crowd") {
         let denStr = b.t3_density || "Massive Army";
         if(denStr.includes("Massive") && b.t3_altitude) denStr += `, ${b.t3_altitude}`;
         story = `${denStr}, ${b.t1_story}`;
         if(!b.t3_framing) framing = "Extreme Wide Shot, Drone View";
       } else if (b.t3_focus === "Detail") {
         story = `Extreme detail close-up, ${b.t1_story}`;
         if(!b.t3_framing) framing = "Low Angle, Ground Level";
       }

       const parts = ["Cinematic, photorealistic", story, b.t3_atm, framing, b.t3_altitude, b.t3_motion, "8k resolution, raw footage"];
       prompt = parts.filter(Boolean).join(", ");
       prompt += ` ${ar} --motion ${b.t3_strength} ( ${b.t3_duration}s )`;
       if(b.t3_seed) prompt += ` --seed ${b.t3_seed}`;
     }

     prompt += neg;
     setRawInput(prompt);
     setOptimizedOutput(prompt); // Auto-set output too for quick testing
     setActiveTab('editor');
  };


  const getModeColor = () => {
    switch (config.mode) {
      case PromptMode.Video: return 'from-purple-600 to-pink-600';
      case PromptMode.Image: return 'from-emerald-500 to-teal-600';
      default: return 'from-primary-600 to-primary-500';
    }
  };

  const getShadowColor = () => {
    switch (config.mode) {
      case PromptMode.Video: return 'shadow-purple-500/25';
      case PromptMode.Image: return 'shadow-emerald-500/25';
      default: return 'shadow-primary-500/25';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-primary-500/30">
      
      {/* Hidden File Input for Import */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".json"
      />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded-lg shadow-lg transition-colors bg-gradient-to-br ${getModeColor().replace('600', '500').replace('500', '400')}`}>
              <Icons.Wand className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              PromptCraft
            </h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            {/* Save/Export Controls */}
            <div className="flex items-center gap-2 border-r border-slate-800 pr-4 mr-2">
              <button 
                onClick={handleExportSession} 
                className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-slate-800 rounded-lg transition-colors" 
                title="Export Workspace to File"
              >
                <Icons.Download className="w-4 h-4" />
              </button>
              <button 
                onClick={handleImportClick} 
                className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-slate-800 rounded-lg transition-colors" 
                title="Import Workspace from File"
              >
                <Icons.Upload className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-800 mx-1"></div>
              <button 
                onClick={manualSave}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${saveStatus === 'saved' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'}`}
              >
                {saveStatus === 'saved' ? <Icons.Check className="w-3.5 h-3.5" /> : <Icons.Save className="w-3.5 h-3.5" />}
                {saveStatus === 'saved' ? 'Saved' : 'Save'}
              </button>
              <button onClick={clearSession} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Clear Session">
                <Icons.Trash2 className="w-4 h-4" />
              </button>
            </div>

            {config.mode === PromptMode.Video && (
               <button onClick={openKeySelection} className="hover:text-primary-400 underline decoration-dotted underline-offset-4 transition-colors">
                 Manage API Key
               </button>
            )}
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-900 border border-slate-800 hidden sm:flex">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {config.mode === PromptMode.Video ? 'Veo 3.1 Active' : (config.mode === PromptMode.Image ? 'Gemini 2.5 Image' : 'Gemini 2.5')}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid lg:grid-cols-12 gap-6">
        
        {/* Left Column: Input & Config */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Mode Switcher */}
          <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex overflow-hidden">
            {Object.values(PromptMode).map((mode) => (
              <button
                key={mode}
                onClick={() => setConfig({...config, mode})}
                className={`flex-1 py-2 text-[10px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap px-1 ${config.mode === mode ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {mode.replace(' Generation', '')}
              </button>
            ))}
          </div>

          {/* Builder Toggle (Only for Video) */}
          {config.mode === PromptMode.Video && (
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
               <button onClick={()=>setInputMode('raw')} className={`flex-1 py-1.5 text-xs rounded ${inputMode==='raw' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Raw Text</button>
               <button onClick={()=>setInputMode('studio')} className={`flex-1 py-1.5 text-xs rounded ${inputMode==='studio' ? 'bg-purple-600 text-white' : 'text-slate-500'}`}>Studio Builder</button>
            </div>
          )}

          {/* Input Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4 flex-1">
            
            {/* STUDIO BUILDER UI */}
            {inputMode === 'studio' && config.mode === PromptMode.Video ? (
              <div className="flex flex-col gap-4">
                 {/* Studio Tabs */}
                 <div className="flex gap-2 border-b border-slate-800 pb-2">
                   {[1,2,3].map(t => (
                     <button key={t} onClick={()=>setBuilderTab(t as 1|2|3)} className={`px-3 py-1 text-xs rounded-full border ${builderTab===t ? 'border-purple-500 text-purple-400 bg-purple-500/10' : 'border-transparent text-slate-500'}`}>
                       {t===1?'World':(t===2?'Camera':'Sequencing')}
                     </button>
                   ))}
                 </div>

                 {builderTab === 1 && (
                   <div className="space-y-3">
                     <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[10px] text-slate-500 uppercase">Ethnicity</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs" value={builderState.t1_race} onChange={e=>handleBuilderChange('t1_race', e.target.value)}><option value="">(Default)</option><option value="Central Asian, Mongol, Turkic features">Mongol / Turkic</option><option value="Middle Eastern, Circassian features">Mamluk (Circassian)</option><option value="East Asian, Han Chinese features">East Asian</option></select></div>
                        <div><label className="text-[10px] text-slate-500 uppercase">Costume</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs" value={builderState.t1_costume} onChange={e=>handleBuilderChange('t1_costume', e.target.value)}><option value="">(Default)</option><option value="Lamellar Armor, Heavy Silk Robes">Mongol: Lamellar & Silk</option><option value="Chainmail with Mirror Plates, Turban Helmet">Mamluk: Mirror Plate</option></select></div>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[10px] text-slate-500 uppercase">Era</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs" value={builderState.t1_period} onChange={e=>handleBuilderChange('t1_period', e.target.value)}><option>Medieval Era, 13th Century</option><option>Ancient Rome, 100 AD</option><option>Cyberpunk 2077 Future</option></select></div>
                        <div><label className="text-[10px] text-slate-500 uppercase">Location</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs" value={builderState.t1_location} onChange={e=>handleBuilderChange('t1_location', e.target.value)}><option>Vast Steppe Grasslands</option><option>Vast Desert Dunes</option><option>Cyberpunk City Street</option></select></div>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[10px] text-slate-500 uppercase">Style</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs" value={builderState.t1_style} onChange={e=>handleBuilderChange('t1_style', e.target.value)}><option>Epic Historical Film</option><option>Cinematic Photorealistic</option><option>Raw War Footage</option><option>3D Animation</option></select></div>
                        <div><label className="text-[10px] text-slate-500 uppercase">Lighting</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs" value={builderState.t1_lighting} onChange={e=>handleBuilderChange('t1_lighting', e.target.value)}><option>Cinematic Volumetric Lighting</option><option>Hard Sunlight</option><option>Firelight</option></select></div>
                     </div>
                     <div><label className="text-[10px] text-slate-500 uppercase">Description</label><textarea className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs h-20" placeholder="Describe the scene..." value={builderState.t1_story} onChange={e=>handleBuilderChange('t1_story', e.target.value)} /></div>
                   </div>
                 )}
                 {builderTab === 2 && (
                    <div className="space-y-3">
                      <div><label className="text-[10px] text-slate-500 uppercase">Shot Description</label><textarea className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs h-16" placeholder="Same as Tab 1..." value={builderState.t2_story || builderState.t1_story} onChange={e=>handleBuilderChange('t2_story', e.target.value)} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[10px] text-slate-500 uppercase">Framing</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs" value={builderState.t2_framing} onChange={e=>handleBuilderChange('t2_framing', e.target.value)}><option>Wide Shot</option><option>Close-up</option><option>Drone View</option></select></div>
                        <div><label className="text-[10px] text-slate-500 uppercase">Movement</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs" value={builderState.t2_movement} onChange={e=>handleBuilderChange('t2_movement', e.target.value)}><option>Static Camera</option><option>Slow Pan Right</option><option>Tracking Shot</option></select></div>
                      </div>
                    </div>
                 )}
                 {builderTab === 3 && (
                    <div className="space-y-3">
                       <div className="grid grid-cols-2 gap-2">
                         <div><label className="text-[10px] text-slate-500 uppercase">Shot Function</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs" value={builderState.t3_focus} onChange={e=>handleBuilderChange('t3_focus', e.target.value)}><option value="Transition">Transition</option><option value="Hero">Hero Shot</option><option value="Crowd">Crowd Scale</option></select></div>
                         <div><label className="text-[10px] text-slate-500 uppercase">Motion</label><select className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs" value={builderState.t3_motion} onChange={e=>handleBuilderChange('t3_motion', e.target.value)}><option>Falcon Aerial Chase</option><option>Falcon Dive to Reveal</option><option>Zoom In</option></select></div>
                       </div>
                       <div><label className="text-[10px] text-slate-500 uppercase">Context Target</label><textarea className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs h-16" placeholder="Who are we looking at?" value={builderState.t1_story} onChange={e=>handleBuilderChange('t1_story', e.target.value)} /></div>
                    </div>
                 )}

                 <button onClick={generateFromBuilder} className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded text-xs font-bold text-white uppercase tracking-wide">
                   Construct & Load Prompt
                 </button>
              </div>
            ) : (
              // RAW TEXT INPUT (Existing Logic)
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <Icons.Sparkles className={`w-4 h-4 ${config.mode === PromptMode.Video ? 'text-purple-500' : (config.mode === PromptMode.Image ? 'text-emerald-500' : 'text-primary-500')}`} />
                    {config.mode === PromptMode.Video ? 'Video Concept' : (config.mode === PromptMode.Image ? 'Image Concept' : 'Raw Idea')}
                  </h2>
                </div>

                <textarea
                  className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none font-mono leading-relaxed min-h-[160px]"
                  placeholder={config.mode === PromptMode.Text
                    ? "e.g., I need a blog post about coffee history, make it sound professional..."
                    : "e.g., A cyberpunk city street at night, neon lights reflecting in puddles, cinematic lighting..."
                  }
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  spellCheck={true}
                />
              </>
            )}

            {/* Negative Constraints Input */}
            <div className="space-y-1.5 border-t border-slate-800 pt-3">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Icons.Ban className="w-3 h-3 text-red-400/80" /> 
                Negative Constraints
              </label>
              <input 
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-red-500/50"
                placeholder="e.g. blurry, text, watermark"
                value={config.negativeConstraint || ''}
                onChange={(e) => setConfig({...config, negativeConstraint: e.target.value})}
                spellCheck={true}
              />
            </div>

            {/* Config Controls */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
               <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Framework</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                  value={config.framework}
                  onChange={(e) => setConfig({...config, framework: e.target.value as OptimizationFramework})}
                >
                  {Object.values(OptimizationFramework).map(f => (
                    <option key={f} value={f}>{f.split(' ')[0]}</option>
                  ))}
                </select>
              </div>

              {config.mode === PromptMode.Video ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Aspect Ratio</label>
                  <select 
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                    value={config.aspectRatio}
                    onChange={(e) => setConfig({...config, aspectRatio: e.target.value})}
                  >
                    <option value="16:9">16:9 (Cinematic)</option>
                    <option value="9:16">9:16 (Mobile)</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Output Tone</label>
                  <select 
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                    value={config.tone}
                    onChange={(e) => setConfig({...config, tone: e.target.value as Tone})}
                  >
                    {Object.values(Tone).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              onClick={handleOptimize}
              disabled={!canOptimize || isOptimizing}
              className={`
                mt-2 w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all text-white shadow-lg active:scale-[0.98]
                ${!canOptimize 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed !shadow-none' 
                  : `bg-gradient-to-r ${getModeColor()} hover:opacity-90 ${getShadowColor()}`
                }
              `}
            >
              {isOptimizing ? (
                <>
                  <Icons.RefreshCw className="w-4 h-4 animate-spin" />
                  Crafting Prompt...
                </>
              ) : (
                <>
                  <Icons.Wand className="w-4 h-4" />
                  Generate {config.mode === PromptMode.Video ? 'Video' : (config.mode === PromptMode.Image ? 'Image' : 'Text')} Prompt
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Output & Test */}
        <div className="lg:col-span-7 flex flex-col gap-6 h-[calc(100vh-8rem)]">
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
            
            {/* Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/30">
              <button
                onClick={() => setActiveTab('editor')}
                className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'editor' ? 'text-primary-400 bg-slate-800/50 border-b-2 border-primary-500' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Icons.Settings className="w-3.5 h-3.5" />
                Optimized Prompt
              </button>
              <button
                onClick={() => setActiveTab('test')}
                className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'test' ? 'text-primary-400 bg-slate-800/50 border-b-2 border-primary-500' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Icons.Play className="w-3.5 h-3.5" />
                Test Playground
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
              {activeTab === 'editor' && (
                <div className="h-full flex flex-col">
                  <div className="flex-1 p-0 relative group">
                     {optimizedOutput ? (
                        <textarea 
                          className="w-full h-full bg-transparent p-6 text-sm font-mono text-slate-300 resize-none focus:outline-none leading-relaxed"
                          value={optimizedOutput}
                          onChange={(e) => setOptimizedOutput(e.target.value)}
                          spellCheck={true}
                        />
                     ) : (
                       <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-3">
                         <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center border border-slate-700">
                           <Icons.ArrowRight className="w-5 h-5 opacity-50" />
                         </div>
                         <p className="text-sm">Your optimized prompt will appear here</p>
                       </div>
                     )}
                     
                     {/* Copy Overlay Action */}
                     {optimizedOutput && (
                       <div className="absolute top-4 right-4">
                         <button 
                            onClick={copyToClipboard}
                            className="p-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shadow-lg"
                            title="Copy to Clipboard"
                          >
                            {copySuccess ? <Icons.Check className="w-4 h-4 text-green-400" /> : <Icons.Copy className="w-4 h-4" />}
                          </button>
                       </div>
                     )}
                  </div>
                  
                  {/* Action Bar */}
                  {optimizedOutput && (
                    <div className="p-4 border-t border-slate-800 bg-slate-950/30 flex justify-end">
                      <button
                        onClick={handleTest}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                      >
                        <Icons.Play className="w-3.5 h-3.5" />
                        Run this Prompt
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'test' && (
                <div className="h-full flex flex-col p-6 overflow-y-auto bg-slate-950/50">
                   {!testResult && !isTesting ? (
                     <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4 text-center">
                        <div className="max-w-xs">
                          {config.mode === PromptMode.Video && (
                            <p className="text-xs text-orange-400/80 mb-2 border border-orange-500/20 bg-orange-500/5 p-2 rounded">
                              Note: Video generation requires a paid API key. 
                              <br/><button onClick={openBilling} className="underline decoration-dotted cursor-pointer hover:text-orange-300">View Pricing</button>
                            </p>
                          )}
                          <p className="text-sm">Click "Run this Prompt" to see what {config.mode === PromptMode.Video ? 'Veo' : 'Gemini'} generates.</p>
                        </div>
                     </div>
                   ) : (
                     <div className="space-y-4 h-full flex flex-col">
                       {isTesting ? (
                         <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
                           <div className="flex gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{animationDelay: '0ms'}}/>
                            <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{animationDelay: '150ms'}}/>
                            <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{animationDelay: '300ms'}}/>
                           </div>
                           <span className="text-sm animate-pulse">{loadingMessage}</span>
                         </div>
                       ) : (
                         <div className="h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4 shrink-0">
                               <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Preview Output</h3>
                               {(testResult.startsWith('data:image') || testResult.startsWith('http') || testResult.startsWith('blob')) && (
                                 <a 
                                   href={testResult} 
                                   download={`generated_media_${new Date().toISOString().slice(0,10)}.${testResult.startsWith('data:image') ? 'png' : 'mp4'}`}
                                   className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-700 transition-colors"
                                 >
                                   <Icons.Download className="w-3.5 h-3.5" /> Download Media
                                 </a>
                               )}
                            </div>
                            
                            {config.mode === PromptMode.Video ? (
                              <div className="flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                                {testResult.startsWith('Error') ? (
                                  <div className="text-red-400 px-4 text-center">{testResult}</div>
                                ) : (
                                  <video 
                                    src={testResult} 
                                    controls 
                                    autoPlay 
                                    loop 
                                    className="max-h-full max-w-full"
                                  />
                                )}
                              </div>
                            ) : config.mode === PromptMode.Image ? (
                               <div className="flex flex-col h-full gap-4">
                                 <div className="flex-1 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800 relative group">
                                  {testResult.startsWith('data:image') ? (
                                    <>
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <p className="text-white font-medium text-sm bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md">Click to Zoom</p>
                                      </div>
                                      <img 
                                        src={testResult} 
                                        alt="Generated Output"
                                        className="max-h-full max-w-full object-contain shadow-2xl cursor-zoom-in hover:scale-[1.01] transition-transform"
                                        onClick={() => setViewImage(testResult)}
                                      />
                                    </>
                                  ) : (
                                    <div className="text-slate-400 px-4 text-center">{testResult}</div>
                                  )}
                                </div>
                                
                                {testResult.startsWith('data:image') && (
                                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                       <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                         <Icons.Scan className="w-3 h-3" /> AI Analysis
                                       </h4>
                                       <button onClick={handleAnalyze} disabled={isAnalyzing} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700 transition-colors">
                                         {isAnalyzing ? 'Analyzing...' : 'Analyze Image'}
                                       </button>
                                    </div>
                                    {analysisResult && (
                                      <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                                        {analysisResult}
                                      </div>
                                    )}
                                  </div>
                                )}
                               </div>
                            ) : (
                              <div className="whitespace-pre-wrap text-slate-300 leading-relaxed bg-slate-900/50 p-4 rounded-lg border border-slate-800/50">
                                {testResult}
                              </div>
                            )}
                         </div>
                       )}
                     </div>
                   )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Full Screen Image Modal */}
      {viewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setViewImage(null)}
        >
          <button 
            className="absolute top-6 right-6 p-2 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
            onClick={() => setViewImage(null)}
          >
            <Icons.X className="w-6 h-6" />
          </button>
          <img 
            src={viewImage} 
            alt="Full Screen Preview" 
            className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
};

export default App;