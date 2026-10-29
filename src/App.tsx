import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Box, Check, ChevronDown, CircleHelp, Copy, Layers3, Leaf, Maximize, Move3D, Plus, RotateCcw, RotateCw, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { generatePlanter, limits, meshStats, presets, validDesign, type Design } from './geometry';
import { download, serializeMesh } from './exports';
import { Viewport, type ViewportHandle } from './Viewport';
import './style.css';

const colors = [
  { name: 'Chalk', hex: '#d8d0bc' }, { name: 'Terracotta', hex: '#ba7155' },
  { name: 'Moss', hex: '#727b51' }, { name: 'Ink', hex: '#3e4748' },
  { name: 'Lavender', hex: '#aaa0b9' }, { name: 'Ochre', hex: '#c69a48' },
];

function initialDesign(): { design: Design; error: string } {
  const encoded = new URLSearchParams(location.hash.slice(1)).get('design');
  if (!encoded) return { design: { ...presets[0].design }, error: '' };
  try {
    const parsed: unknown = JSON.parse(encoded);
    if (!validDesign(parsed)) throw new Error('Invalid shared parameters.');
    return { design: parsed, error: '' };
  } catch (error) {
    console.error('Failed to load shared design', error);
    return { design: { ...presets[0].design }, error: 'This design link is invalid. The Helix starting design has been loaded instead.' };
  }
}

export default function App() {
  const [initial] = useState(initialDesign);
  const [design, setDesign] = useState(initial.design);
  const [activePreset, setActivePreset] = useState(() => presets.find(preset =>
    (Object.keys(preset.design) as (keyof Design)[]).every(key => preset.design[key] === initial.design[key]))?.name ?? '');
  const [colorIndex, setColorIndex] = useState(1);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [format, setFormat] = useState<'stl' | 'obj'>('stl');
  const [notice, setNotice] = useState(initial.error);
  const [help, setHelp] = useState(false);
  const [exporting, setExporting] = useState(false);
  const viewport = useRef<ViewportHandle>(null);
  const modal = useRef<HTMLElement>(null);
  const geometry = useMemo(() => generatePlanter(design), [design]);
  const stats = useMemo(() => meshStats(geometry), [geometry]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!help) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHelp(false);
      if (event.key !== 'Tab') return;
      const buttons = modal.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [help]);
  function update<K extends keyof Design>(key: K, value: Design[K]) {
    setDesign(previous => ({ ...previous, [key]: value }));
    setActivePreset('');
  }
  async function share() {
    const url = new URL(location.href);
    url.hash = new URLSearchParams({ design: JSON.stringify(design) }).toString();
    try {
      await navigator.clipboard.writeText(url.href);
      history.replaceState(null, '', url);
      setNotice('Design link copied. Anyone with this link can recreate your geometry.');
    } catch (error) {
      console.error('Clipboard failed', error);
      setNotice('Clipboard access was denied. Your design link is now in the address bar; copy it from there.');
      history.replaceState(null, '', url);
    }
  }
  async function exportModel() {
    setExporting(true);
    try {
      download(serializeMesh(geometry, format), `FORM-planter-${design.height}mm.${format}`);
      setNotice(`${format.toUpperCase()} exported in millimeters, Z-up. Check orientation and settings in your slicer before printing.`);
    } catch (error) {
      console.error('Export failed', error);
      setNotice('Export failed. Please try again or choose another format.');
    } finally { setExporting(false); }
  }
  async function snapshot() {
    try {
      if (!viewport.current) throw new Error('Viewport is not ready.');
      download(await viewport.current.image(), 'FORM-design.png');
      setNotice('Studio snapshot saved.');
    } catch (error) {
      console.error('Snapshot failed', error);
      setNotice('Could not capture the viewport. Make sure the 3D preview is available.');
    }
  }
  function slider(key: keyof typeof limits, title: string, unit: string, step = 1) {
    const [min, max] = limits[key];
    return <div className="parameter" key={key}>
      <label htmlFor={key}>{title}<span>{design[key]}<small>{unit}</small></span></label>
      <input id={key} type="range" min={min} max={max} step={step} value={design[key]}
        style={{ '--progress': `${(design[key] - min) / (max - min) * 100}%` } as React.CSSProperties}
        onChange={event => update(key, Number(event.target.value))} />
      <div className="range-labels"><span>{min}{unit}</span><span>{max}{unit}</span></div>
    </div>;
  }
  const steep = Math.abs(design.twist) > 85 || design.depth > 3.5;
  return <div className="app">
    <header>
      <a className="brand" href={location.pathname} aria-label="FORM home">form<span>®</span><i /></a>
      <div className="header-divider" /><span className="header-tag">OBJECTS, MADE PERSONAL.</span>
      <nav><span className="project-badge"><span /> LIVE GEOMETRY</span><button className="text-button" onClick={() => setHelp(true)}>The process <ArrowUpRight size={14} /></button><button className="share-button" onClick={share}><Copy size={14} /> Share design</button></nav>
    </header>
    <main>
      <section className="intro">
        <div><div className="eyebrow"><span className="tiny-cross">✳</span> THE PARAMETRIC COLLECTION / NO. 001</div><h1>A little shape.<br /><span>A lot of possibility.</span></h1><p>From a small idea to something you can hold.<br className="mobile-break" /> Make a planter that’s entirely your own.</p></div>
        <div className="intro-note"><div className="note-icon"><Move3D size={23} strokeWidth={1.2} /></div><p>Not a pre-made model.<br /><strong>Your parameters. Your geometry.</strong></p><span>DESIGNED BY YOU. GENERATED IN REAL TIME.</span></div>
      </section>
      <section className="studio" aria-label="Planter design studio">
        <div className="viewer-panel">
          <div className="viewer-top"><div><span className="section-index">01 /</span> THE CANVAS <span className="live-dot" /></div><button onClick={snapshot} className="icon-button" title="Save preview image" aria-label="Save preview image"><ArrowDownToLine size={17} /></button></div>
          <Viewport ref={viewport} geometry={geometry} color={colors[colorIndex].hex} wireframe={wireframe} autoRotate={autoRotate} />
          <div className="object-caption"><span>FIG. 001</span><h2>{activePreset || 'Your creation'}<span> / planter</span></h2><p>PROCEDURAL SERIES · {colors[colorIndex].name.toUpperCase()}</p></div>
          <div className="vertical-measure"><span>{design.height} mm</span></div>
          <div className="viewer-tools"><button className={autoRotate ? 'selected' : ''} onClick={() => setAutoRotate(!autoRotate)} aria-label="Auto rotate" aria-pressed={autoRotate} title="Auto rotate"><RotateCw size={17} /></button><button className={wireframe ? 'selected' : ''} onClick={() => setWireframe(!wireframe)} aria-label="Wireframe" aria-pressed={wireframe} title="Inspect wireframe"><Layers3 size={17} /></button><span /><button onClick={() => viewport.current?.reset()} aria-label="Reset camera" title="Reset camera"><Maximize size={17} /></button></div>
          <div className="viewer-bottom"><span><Move3D size={13} /> DRAG TO ORBIT <i /> SCROLL TO ZOOM</span><span>mm <Plus size={12} /></span></div>
        </div>
        <aside className="control-panel">
          <div className="control-title"><div><span className="eyebrow">THE GOOD PART</span><h2>Make it yours.</h2></div><SlidersHorizontal size={20} strokeWidth={1.4} /></div>
          <div className="controls-scroll">
            <section className="control-section"><div className="section-heading"><span>01</span><h3>Pick a starting point</h3></div>
              <div className="presets">{presets.map((preset, i) => <button key={preset.name} onClick={() => { setDesign({ ...preset.design }); setActivePreset(preset.name); }} className={activePreset === preset.name ? 'active' : ''} aria-pressed={activePreset === preset.name}><div className={`mini-pot pot-${i}`} /><span>{preset.name}</span>{activePreset === preset.name && <span className="preset-check"><Check size={10} /></span>}</button>)}</div>
            </section>
            <section className="control-section dimensions"><div className="section-heading"><span>02</span><h3>Find your proportions</h3><span className="unit-tag">MM</span></div>
              {slider('height', 'Height', 'mm')}{slider('diameter', 'Top diameter', 'mm')}{slider('taper', 'Base / top ratio', '%')}
            </section>
            <section className="control-section"><div className="section-heading"><span>03</span><h3>Add a little character</h3><Sparkles size={14} /></div>
              {slider('twist', 'Twist', '°')}{slider('ribs', 'Flutes', '')}{slider('depth', 'Flute depth', 'mm', 0.1)}
            </section>
            <section className="control-section"><div className="section-heading"><span>04</span><h3>Choose your finish</h3><span className="color-name">{colors[colorIndex].name}</span></div>
              <div className="swatches">{colors.map((color, i) => <button key={color.name} style={{ backgroundColor: color.hex }} className={colorIndex === i ? 'active' : ''} aria-label={color.name} aria-pressed={colorIndex === i} onClick={() => setColorIndex(i)}>{colorIndex === i && <Check size={15} />}</button>)}</div><p className="microcopy">A preview of your filament. Geometry exports without color.</p>
            </section>
            <section className="control-section print-settings"><div className="section-heading"><span>05</span><h3>Built for the real world</h3></div>
              {slider('wall', 'Radial wall thickness', 'mm', 0.1)}
              <label className="toggle-row"><span><Leaf size={16} /><span>Drainage hole<small>6 mm opening · happy roots</small></span></span><input type="checkbox" checked={design.drainage} onChange={e => update('drainage', e.target.checked)} /><span className="toggle" /></label>
            </section>
          </div>
          <div className="export-panel"><div className="export-row"><span><span className="live-dot" /> ONE CLOSED MESH</span><button onClick={() => { setDesign({ ...presets[0].design }); setActivePreset('Helix'); setColorIndex(1); setWireframe(false); setAutoRotate(false); viewport.current?.reset(); }} title="Reset design"><RotateCcw size={12} /> Reset</button></div><div className="export-buttons"><button className="export-button" onClick={exportModel} disabled={exporting}><ArrowDownToLine size={17} /> {exporting ? 'Preparing…' : 'Export your design'}<ArrowRight size={17} /></button><div className="format-select"><select aria-label="Export format" value={format} onChange={e => setFormat(e.target.value as 'stl' | 'obj')}><option value="stl">STL</option><option value="obj">OBJ</option></select><ChevronDown size={12} /></div></div><p>No sign-up. No cloud. Just your next creation.</p></div>
        </aside>
      </section>
      <section className="specs" aria-label="Model specifications"><div className="spec-lead"><Box size={21} strokeWidth={1.3} /><span>FROM PIXELS<br /><strong>TO PRINT.</strong></span></div><div><span>BOUNDING SIZE</span><strong>{Math.round(design.diameter + design.depth * 2)} × {design.height}<small> mm · Ø × H envelope</small></strong></div><div><span>MESH RESOLUTION</span><strong>{(stats.triangles / 1000).toFixed(1)}k<small> triangles</small></strong></div><div><span>MATERIAL VOLUME</span><strong>{stats.volumeCm3.toFixed(1)}<small> cm³ · {Math.round(stats.grams)} g PLA*</small></strong></div><div className={`print-status ${steep ? 'caution' : ''}`}><span>{steep ? <CircleHelp size={15} /> : <Check size={15} />}{steep ? 'Slicer review advised' : 'Ready for your slicer'}</span><p>{steep ? 'Deep flutes / twist may need supports.' : 'Flat base · hollow body · closed surface'}</p></div></section>
      <div className="bottom-note"><span>* Solid-shell material estimate at 1.24 g/cm³. Actual filament depends on your slicer. Radial wall spacing is not a certified minimum normal thickness.</span><button onClick={() => setHelp(true)}>A note on printing <ArrowUpRight size={12} /></button></div>
      <section className="closing"><div className="closing-mark">f.</div><p>Less mass-produced.<br /><em>More you-produced.</em></p><span>A SMALL EXPERIMENT IN MAKING THINGS YOUR OWN.<br />BUILT WITH MATH. FINISHED BY YOU.</span></section>
    </main>
    <footer><span>FORM STUDIO / 2026</span><span>PROCEDURAL BY NATURE. PERSONAL BY DESIGN.</span><button onClick={() => setHelp(true)}>Under the hood <Plus size={12} /></button></footer>
    {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16} /></button></div>}
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section ref={modal} className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button autoFocus className="modal-close icon-button" onClick={() => setHelp(false)} aria-label="Close guide"><X size={20} /></button><span className="eyebrow">FROM PARAMETERS TO PLASTIC</span><h2 id="help-title">Real geometry.<br />No smoke and mirrors.</h2><p>Every slider rebuilds an indexed triangle mesh in your browser: the exterior, interior, rim, floor, underside and optional drain are connected into one closed surface. The viewport and exports use the same geometry.</p><h3>A good first print</h3><p>Start with PLA, a 0.4 mm nozzle and 0.2 mm layers. Import the STL or OBJ as <strong>millimeters</strong>. Exports are Z-up with the base at zero. Inspect wall thickness, overhangs and supports in your slicer, especially with deep flutes and strong twist.</p><p>This is a geometry tool, not print certification. Thin radial walls can be thinner along the surface normal. Drainage is real; without drainage, a printed planter still isn't guaranteed watertight. Use a liner for indoor plants.</p><div className="tech-stack"><span>React + TypeScript</span><span>Three.js / WebGL</span><span>Parametric mesh</span><span>Binary STL + OBJ</span></div><button className="export-button" onClick={() => setHelp(false)}>Let’s make something <ArrowRight size={17} /></button></section></div>}
  </div>;
}
