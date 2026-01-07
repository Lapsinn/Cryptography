import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, Lock, User, Shield, Eye, EyeOff, Copy, Check, 
  Upload, FileText, ZoomIn, Download, Activity, Database, 
  Zap, X, Clock, Binary, Key, RefreshCcw, ImageIcon 
} from 'lucide-react';

// ==================== I. CHAOTIC FSM ENGINE ====================
/**
 * LogisticMoore Class:
 * Implements a Moore-type state generator driven by the Logistic Map equation.
 */
class LogisticMoore {
  constructor(keyString, stabilizationSteps = 1000) {
    this.r = 3.9999; 
    this.stabilizationSteps = stabilizationSteps;
    this.state = this._initializeSeed(keyString);
    this._stabilizeState();
  }

  _initializeSeed(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    return 0.1 + (Math.abs(hash) % 800000) / 1000000.0;
  }

  _stabilizeState() {
    for (let i = 0; i < this.stabilizationSteps; i++) {
      this._transition();
    }
  }

  _transition() {
    let next = this.r * this.state * (1 - this.state);
    if (next <= 0 || next >= 1) next = 0.5;
    this.state = next;
  }

  produceOutput() {
    this._transition();
    const magnified = Math.floor(this.state * 1e14);
    return (Math.floor(magnified / 256) >>> 0);
  }

  generateStream(count) {
    const stream = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
      stream[i] = this.produceOutput();
    }
    return stream;
  }
}

/**
 * MealyMachine Class:
 * Enhanced to capture state trajectory for mathematical auditing.
 */
class MealyMachine {
  constructor(nStates, mAlphabet) {
    this.n = nStates;
    this.m = mAlphabet;
    this.currentState = 0;
    this.delta = Array.from({ length: nStates }, () => new Int32Array(mAlphabet));
    this.lambdaTable = Array.from({ length: nStates }, () => new Int32Array(mAlphabet));
    this.lambdaInv = Array.from({ length: nStates }, () => new Int32Array(mAlphabet));
  }

  reset() { this.currentState = 0; }

  encryptBytes(bytes) {
    this.reset();
    for (let j = 0; j < 500; j++) {
      this.currentState = this.delta[this.currentState][j % 256];
    }

    const ciphertext = new Uint8Array(bytes.length);
    const trajectory = []; 
    for (let i = 0; i < bytes.length; i++) {
      const stateIdx = this.currentState;
      const input = bytes[i];
      const output = this.lambdaTable[stateIdx][input];
      const nextState = (this.delta[stateIdx][input] + i) % this.n;

      ciphertext[i] = output;
      
      if (i < 20) {
        trajectory.push({ t: i, s: stateIdx, i: input, sPrime: nextState, o: output });
      }
      
      this.currentState = nextState;
    }
    return { ciphertext, trajectory };
  }

  decryptBytes(bytes) {
    this.reset();
    for (let j = 0; j < 500; j++) {
      this.currentState = this.delta[this.currentState][j % 256];
    }
    
    const plaintext = new Uint8Array(bytes.length);
    const trajectory = [];
    for (let i = 0; i < bytes.length; i++) {
      const stateIdx = this.currentState;
      const recovered = this.lambdaInv[stateIdx][bytes[i]];
      const nextState = (this.delta[stateIdx][recovered] + i) % this.n;

      plaintext[i] = recovered;

      if (i < 20) {
        trajectory.push({ t: i, s: stateIdx, i: recovered, sPrime: nextState, o: bytes[i] });
      }

      this.currentState = nextState;
    }
    return { plaintext, trajectory };
  }
}

function buildMealyMachine(mooreGen, nStates, mAlphabet) {
  const machine = new MealyMachine(nStates, mAlphabet);
  const totalNeeded = (nStates * mAlphabet) * 2;
  const entropy = mooreGen.generateStream(totalNeeded);
  let cursor = 0;

  for (let s = 0; s < nStates; s++) {
    for (let i = 0; i < mAlphabet; i++) {
      machine.delta[s][i] = Math.abs(entropy[cursor]) % nStates;
      cursor++;
    }
  }

  for (let s = 0; s < nStates; s++) {
    const perm = new Uint8Array(mAlphabet);
    for (let i = 0; i < mAlphabet; i++) perm[i] = i;
    for (let i = mAlphabet - 1; i > 0; i--) {
      const j = Math.abs(entropy[cursor]) % (i + 1);
      const temp = perm[i]; perm[i] = perm[j]; perm[j] = temp;
      cursor++;
    }
    for (let i = 0; i < mAlphabet; i++) {
      const val = perm[i];
      machine.lambdaTable[s][i] = val;
      machine.lambdaInv[s][val] = i;
    }
  }
  return machine;
}

// ==================== II. SECURITY METRICS ====================

const calculateNPCR = (plain, cipher) => {
  if (!plain || !cipher || plain.length !== cipher.length) return "0.00";
  let diff = 0;
  for (let i = 0; i < plain.length; i++) if (plain[i] !== cipher[i]) diff++;
  return ((diff / plain.length) * 100).toFixed(2);
};

const calculateEntropy = (data) => {
  if (!data || data.length === 0) return "0.0000";
  const freq = {};
  for (let val of data) freq[val] = (freq[val] || 0) + 1;
  let entropy = 0;
  const total = data.length;
  for (let count of Object.values(freq)) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  return entropy.toFixed(4);
};

// ==================== III. MAIN APPLICATION ====================

const App = () => {
  const [user1Name, setUser1Name] = useState('You');
  const [user2Name, setUser2Name] = useState('Partner');
  const [sharedKey, setSharedKey] = useState('Butterfly_Effect_2026');
  const [messages, setMessages] = useState([]);
  const [user1Input, setUser1Input] = useState('');
  const [user2Input, setUser2Input] = useState('');
  const [user1File, setUser1File] = useState(null); 
  const [user2File, setUser2File] = useState(null); 
  const [lastHex, setLastHex] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showEncrypted, setShowEncrypted] = useState(true);
  const [activeUser, setActiveUser] = useState('user1');
  const [copied, setCopied] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [inspectingTrajectory, setInspectingTrajectory] = useState(null); 
  
  // Vault Tools State
  const [showVaultTools, setShowVaultTools] = useState(false);
  const [vaultToolMode, setVaultToolMode] = useState('encrypt'); 
  const [vaultDataType, setVaultDataType] = useState('text'); 
  const [vaultTextInput, setVaultTextInput] = useState('');
  const [vaultDecryptedText, setVaultDecryptedText] = useState('');
  const [vaultDecryptedImage, setVaultDecryptedImage] = useState(null);
  const [vaultFile, setVaultFile] = useState(null);
  const [vaultProcessing, setVaultProcessing] = useState(false);

  const messagesEndRef = useRef(null);
  const user1FileInputRef = useRef(null);
  const user2FileInputRef = useRef(null);
  const vaultFileInputRef = useRef(null);

  const mealyMachine = useMemo(() => {
    const moore = new LogisticMoore(sharedKey);
    return buildMealyMachine(moore, 1024, 256);
  }, [sharedKey]);

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const uint8ToB64 = (arr) => {
    let binary = '';
    for (let i = 0; i < arr.byteLength; i++) binary += String.fromCharCode(arr[i]);
    return btoa(binary);
  };

  const b64ToUint8 = (b64) => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const uint8ToHex = (arr) => Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(' ');

  const copyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try { 
      document.execCommand('copy'); 
      setCopied(true); 
      setTimeout(() => setCopied(false), 2000); 
    } catch (err) {}
    document.body.removeChild(textArea);
  };

  const handleDecrypt = (b64) => {
    if (!b64) return { text: '', trajectory: [] };
    try {
      const bytes = b64ToUint8(b64);
      const { plaintext, trajectory } = mealyMachine.decryptBytes(bytes);
      return { text: decoder.decode(plaintext), trajectory };
    } catch (e) { return { text: '[DECRYPTION ERROR]', trajectory: [] }; }
  };

  // --- Manual Vault Processing Logic ---
  const processVaultAction = async () => {
    setVaultProcessing(true);
    try {
      if (vaultDataType === 'text') {
        if (vaultToolMode === 'encrypt') {
          const bytes = encoder.encode(vaultTextInput);
          const { ciphertext } = mealyMachine.encryptBytes(bytes);
          const blob = new Blob([ciphertext], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `secret_note_${Date.now()}.mealy`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          if (!vaultFile) return;
          const reader = new FileReader();
          reader.onload = (e) => {
            const bytes = new Uint8Array(e.target.result);
            const { plaintext } = mealyMachine.decryptBytes(bytes);
            setVaultDecryptedText(decoder.decode(plaintext));
          };
          reader.readAsArrayBuffer(vaultFile);
        }
      } else if (vaultDataType === 'image') {
          if (!vaultFile) return;
          const reader = new FileReader();
          
          if (vaultToolMode === 'encrypt') {
              reader.onload = (e) => {
                  const img = new Image();
                  img.onload = () => {
                      const canvas = document.createElement('canvas');
                      const maxSize = 800; 
                      let { width, height } = img;
                      const ratio = Math.min(maxSize / width, maxSize / height, 1);
                      width = Math.floor(width * ratio);
                      height = Math.floor(height * ratio);
                      
                      canvas.width = width; canvas.height = height;
                      const ctx = canvas.getContext('2d');
                      ctx.drawImage(img, 0, 0, width, height);
                      const imgData = ctx.getImageData(0, 0, width, height);
                      
                      // Support Color RGB (Flattened stream: R,G,B,R,G,B...)
                      const pixels = new Uint8Array(width * height * 3);
                      for (let i = 0; i < imgData.data.length; i += 4) {
                          const base = (i / 4) * 3;
                          pixels[base] = imgData.data[i];
                          pixels[base + 1] = imgData.data[i + 1];
                          pixels[base + 2] = imgData.data[i + 2];
                      }
                      
                      const { ciphertext } = mealyMachine.encryptBytes(pixels);
                      
                      // Render Ciphertext to Canvas for color PNG export
                      const encData = ctx.createImageData(width, height);
                      for (let i = 0; i < width * height; i++) {
                          encData.data[i * 4] = ciphertext[i * 3];
                          encData.data[i * 4 + 1] = ciphertext[i * 3 + 1];
                          encData.data[i * 4 + 2] = ciphertext[i * 3 + 2];
                          encData.data[i * 4 + 3] = 255;
                      }
                      ctx.putImageData(encData, 0, 0);
                      
                      canvas.toBlob((blob) => {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `encrypted_color_visual_${Date.now()}.png`;
                          a.click();
                          URL.revokeObjectURL(url);
                      }, 'image/png');
                  };
                  img.src = e.target.result;
              };
              reader.readAsDataURL(vaultFile);
          } else {
              // Decrypting color PNG back to original
              reader.onload = (e) => {
                  const img = new Image();
                  img.onload = () => {
                      const canvas = document.createElement('canvas');
                      canvas.width = img.width; canvas.height = img.height;
                      const ctx = canvas.getContext('2d');
                      ctx.drawImage(img, 0, 0);
                      const imgData = ctx.getImageData(0, 0, img.width, img.height);
                      
                      // Extract RGB stream from PNG
                      const pixels = new Uint8Array(img.width * img.height * 3);
                      for (let i = 0; i < imgData.data.length; i += 4) {
                          const base = (i / 4) * 3;
                          pixels[base] = imgData.data[i];
                          pixels[base + 1] = imgData.data[i + 1];
                          pixels[base + 2] = imgData.data[i + 2];
                      }
                      
                      const { plaintext } = mealyMachine.decryptBytes(pixels);
                      
                      // Render Color Recovery
                      const recData = ctx.createImageData(img.width, img.height);
                      for (let i = 0; i < img.width * img.height; i++) {
                          recData.data[i * 4] = plaintext[i * 3];
                          recData.data[i * 4 + 1] = plaintext[i * 3 + 1];
                          recData.data[i * 4 + 2] = plaintext[i * 3 + 2];
                          recData.data[i * 4 + 3] = 255;
                      }
                      ctx.putImageData(recData, 0, 0);
                      setVaultDecryptedImage(canvas.toDataURL());
                  };
                  img.src = e.target.result;
              };
              reader.readAsDataURL(vaultFile);
          }
      }
    } finally {
      setVaultProcessing(false);
    }
  };

  const sendMessage = (sender, message, file = null) => {
    const fileToUse = file || (sender === 'user1' ? user1File : user2File); 
    if (!message.trim() && !fileToUse) return;

    if (fileToUse && fileToUse.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 400; 
          let { width, height } = img;
          const ratio = Math.min(maxSize / width, maxSize / height, 1);
          width *= ratio; height *= ratio;
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const imgData = ctx.getImageData(0, 0, width, height);
          
          // Chat images use RGB stream
          const pixels = new Uint8Array(width * height * 3);
          for (let i = 0; i < imgData.data.length; i += 4) {
              const base = (i / 4) * 3;
              pixels[base] = imgData.data[i];
              pixels[base + 1] = imgData.data[i + 1];
              pixels[base + 2] = imgData.data[i + 2];
          }
          
          const startTime = performance.now();
          const { ciphertext, trajectory } = mealyMachine.encryptBytes(pixels);
          const endTime = performance.now();
          const duration = (endTime - startTime).toFixed(3);
          
          setLastHex(uint8ToHex(ciphertext).slice(0, 3000) + (ciphertext.length * 3 > 3000 ? "..." : ""));

          const encCanvas = document.createElement('canvas');
          encCanvas.width = width; encCanvas.height = height;
          const encCtx = encCanvas.getContext('2d');
          const encData = encCtx.createImageData(width, height);
          for (let i = 0; i < width * height; i++) {
            encData.data[i * 4] = ciphertext[i * 3];
            encData.data[i * 4 + 1] = ciphertext[i * 3 + 1];
            encData.data[i * 4 + 2] = ciphertext[i * 3 + 2];
            encData.data[i * 4 + 3] = 255;
          }
          encCtx.putImageData(encData, 0, 0);

          setMessages(prev => [...prev, {
            id: Date.now(), sender, senderName: sender === 'user1' ? user1Name : user2Name,
            plaintext: message || `📷 Color Payload`,
            encrypted: uint8ToB64(ciphertext),
            timestamp: new Date().toLocaleTimeString(),
            isImage: true, imageData: e.target.result, encryptedImageData: encCanvas.toDataURL(),
            originalPixels: pixels, encryptedPixels: ciphertext, width, height,
            procTime: duration, trajectory
          }]);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(fileToUse);
      if (sender === 'user1') { setUser1File(null); if (user1FileInputRef.current) user1FileInputRef.current.value = ''; }
      else { setUser2File(null); if (user2FileInputRef.current) user2FileInputRef.current.value = ''; }
    } else {
      const bytes = encoder.encode(message);
      const startTime = performance.now();
      const { ciphertext, trajectory } = mealyMachine.encryptBytes(bytes);
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(3);

      setLastHex(uint8ToHex(ciphertext));
      setMessages(prev => [...prev, {
        id: Date.now(), sender, senderName: sender === 'user1' ? user1Name : user2Name,
        plaintext: message, encrypted: uint8ToB64(ciphertext),
        timestamp: new Date().toLocaleTimeString(), isImage: false,
        procTime: duration, trajectory
      }]);
    }
    sender === 'user1' ? setUser1Input('') : setUser2Input('');
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 font-sans antialiased overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <header className="flex flex-col items-center mb-8 pt-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <Shield className="text-emerald-400" size={32} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-white uppercase">
              FSM-Mealy <span className="text-emerald-400">Cryptosystem</span>
            </h1>
            <button 
              onClick={() => setShowVaultTools(true)}
              className="ml-2 p-3 bg-slate-800 hover:bg-emerald-600 text-white rounded-2xl transition-all shadow-lg active:scale-95 border border-slate-700"
              title="Vault Cryptographic Processor"
            >
              <Key size={20} />
            </button>
          </div>
          <p className="text-slate-500 text-[10px] font-mono tracking-[0.4em] uppercase">
            Chaos-Driven Finite State Automaton Cryptosystem
          </p>
        </header>

        {/* Key Configuration Card */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 mb-8 backdrop-blur-md shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="text-emerald-500" size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Master Secret Key (Logistic Seed)</span>
          </div>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={sharedKey}
                onChange={(e) => setSharedKey(e.target.value)}
                className="w-full bg-black/40 border border-slate-700 rounded-2xl px-6 py-4 font-mono text-emerald-400 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition-colors">
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button onClick={() => copyToClipboard(sharedKey)} className="bg-slate-800 hover:bg-slate-700 px-6 rounded-2xl border border-slate-700 transition-all flex items-center justify-center min-w-[64px]">
              {copied ? <Check size={20} className="text-emerald-400" /> : <Copy size={20} />}
            </button>
          </div>
        </section>

        {/* Dual User Terminals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {[
            { id: 'user1', name: user1Name, setName: setUser1Name, input: user1Input, setInput: setUser1Input, ref: user1FileInputRef, accent: 'blue', pendingFile: user1File, setFile: setUser1File },
            { id: 'user2', name: user2Name, setName: setUser2Name, input: user2Input, setInput: setUser2Input, ref: user2FileInputRef, accent: 'emerald', pendingFile: user2File, setFile: setUser2File }
          ].map(u => (
            <div key={u.id} className={`bg-slate-900 rounded-3xl border transition-all duration-300 ${activeUser === u.id ? `border-${u.accent}-500/50 shadow-2xl` : 'border-slate-800'}`}>
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/20 rounded-t-3xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${u.id === 'user1' ? 'bg-blue-600' : 'bg-emerald-600 shadow-emerald-900/20'} shadow-lg`}>
                    <User size={20} className="text-white" />
                  </div>
                  <input value={u.name} onChange={(e) => u.setName(e.target.value)} className="bg-transparent font-bold text-lg focus:outline-none w-32 text-white" />
                </div>
                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                  <Zap size={10} className="text-yellow-500" />
                  STATION_READY
                </div>
              </div>

              <div className="p-6">
                <div className="bg-black/30 rounded-2xl h-[400px] overflow-y-auto mb-6 p-6 space-y-6 border border-slate-800/50 custom-scrollbar">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === u.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl p-4 border shadow-sm relative group/bubble ${
                        msg.sender === u.id ? `bg-slate-800 border-slate-700 text-slate-100` : 'bg-slate-900/60 border-slate-800 text-slate-300'
                      }`}>
                        <button onClick={() => setInspectingTrajectory(msg)} className="absolute -top-2 -right-2 p-1.5 bg-emerald-500 text-white rounded-full opacity-0 group-hover/bubble:opacity-100 transition-all hover:scale-110 shadow-lg z-10"><Zap size={10} fill="currentColor" /></button>

                        {showEncrypted && msg.sender !== u.id && (
                          <div className="mb-2 pb-2 border-b border-white/5 opacity-50"><code className="text-[9px] text-emerald-400 break-all font-mono leading-none">{msg.encrypted.slice(0, 40)}...</code></div>
                        )}

                        <div className="text-[9px] font-black uppercase opacity-20 tracking-widest mb-2">{msg.senderName}</div>
                        {msg.isImage ? (
                          <div className="space-y-2"><img src={msg.imageData} className="rounded-xl border border-white/5 cursor-pointer shadow-md" onClick={() => setSelectedImage(msg)} /><div className="flex items-center gap-2 opacity-40"><Database size={10} /><span className="text-[9px] font-mono uppercase">Color_Packet_RCVD</span></div></div>
                        ) : (
                          <p className="text-sm font-medium leading-relaxed">{msg.sender === u.id ? msg.plaintext : handleDecrypt(msg.encrypted).text}</p>
                        )}
                        <div className={`flex items-center gap-3 mt-2 text-[8px] font-mono opacity-40 border-t border-white/5 pt-2 ${msg.sender === u.id ? 'justify-end' : 'justify-start'}`}>
                          <span className="flex items-center gap-1"><Clock size={8} /> {msg.procTime}ms</span><span>{msg.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {u.pendingFile && (
                  <div className="mb-3 p-2 px-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between text-[10px] text-slate-400 font-mono animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2"><FileText size={12} className="text-emerald-500" />STAGED: {u.pendingFile.name}</div>
                    <button onClick={() => { u.setFile(null); if (u.ref.current) u.ref.current.value = ''; }} className="hover:text-red-400"><X size={14} /></button>
                  </div>
                )}

                <div className="flex gap-3">
                  <input value={u.input} onChange={(e) => u.setInput(e.target.value)} onFocus={() => setActiveUser(u.id)} onKeyPress={(e) => e.key === 'Enter' && sendMessage(u.id, u.input)} className="flex-1 bg-black/60 border border-slate-800 rounded-2xl px-5 py-3 text-sm focus:border-slate-600 outline-none" placeholder="Enter stream..." />
                  <input type="file" ref={u.ref} className="hidden" onChange={(e) => u.setFile(e.target.files[0])} />
                  <button onClick={() => u.ref.current.click()} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 border border-slate-700"><Upload size={20} /></button>
                  <button onClick={() => sendMessage(u.id, u.input)} className={`p-3 rounded-2xl text-white ${u.id === 'user1' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}><Send size={20} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Global Persistence Logs & Buffer */}
        <section className="bg-black/60 border border-slate-800 rounded-3xl p-6 shadow-xl mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3"><Activity className="text-blue-400" size={16} /><h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Outgoing Hex Buffer</h3></div>
          </div>
          <div className="bg-slate-900/50 rounded-2xl p-5 min-h-[100px] border border-white/5 overflow-y-auto max-h-[150px] scrollbar-hide"><code className="text-emerald-500 font-mono text-[10px] break-all leading-normal opacity-80">{lastHex || "[ MONITORING_READY ]"}</code></div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-3 mb-6"><Database size={16} /> Transaction Persistence Log</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] font-mono">
              <thead className="text-slate-500 uppercase border-b border-slate-800">
                <tr><th className="py-3 px-4">Origin</th><th className="py-3 px-4">Payload</th><th className="py-3 px-4">Proc_Time</th><th className="py-3 px-4 text-right">Time</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {messages.length === 0 ? (
                  <tr><td colSpan="4" className="py-10 text-center opacity-30 italic">Queue Empty</td></tr>
                ) : (
                  messages.map(msg => (<tr key={msg.id} className="hover:bg-white/5 transition-colors"><td className="py-3 px-4 font-bold text-blue-400">{msg.senderName}</td><td className="py-3 px-4 text-slate-400">{msg.plaintext.slice(0, 30)}...</td><td className="py-3 px-4 text-orange-400/80">{msg.procTime}ms</td><td className="py-3 px-4 text-right text-slate-600">{msg.timestamp}</td></tr>))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* MODALS */}
        {/* Trajectory Panel */}
        <div className={`fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-800 shadow-2xl z-[60] transform transition-transform duration-500 p-6 overflow-y-auto custom-scrollbar ${inspectingTrajectory ? 'translate-x-0' : 'translate-x-full'}`}>
          {inspectingTrajectory && (
            <>
              <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                <h4 className="text-white font-black text-sm uppercase tracking-tighter flex items-center gap-2"><Binary className="text-emerald-400" size={16} />FSM_Trajectory</h4>
                <button onClick={() => setInspectingTrajectory(null)} className="p-2 bg-slate-800 text-slate-400 rounded-xl"><X size={16} /></button>
              </div>
              <div className="space-y-3 font-mono text-[9px]">
                {inspectingTrajectory.trajectory.map((step) => (
                  <div key={step.t} className="bg-black/40 border border-white/5 rounded-xl p-3">
                    <div className="text-slate-600 font-bold mb-2 flex justify-between"><span>STEP_{step.t}</span><span className="text-blue-500/40">S:{step.s}</span></div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2"><span className="text-slate-500">δ(</span><span className="text-blue-400">S{step.s}</span><span className="text-slate-500">,</span><span className="text-white">0x{step.i.toString(16)}</span><span className="text-slate-500">) →</span><span className="text-blue-400">S{step.sPrime}</span></div>
                      <div className="flex items-center gap-2"><span className="text-slate-500">λ(</span><span className="text-blue-400">S{step.s}</span><span className="text-slate-500">,</span><span className="text-white">0x{step.i.toString(16)}</span><span className="text-slate-500">) →</span><span className="text-emerald-400 font-bold">0x{step.o.toString(16)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Vault Utility Tools Modal */}
        {showVaultTools && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[70] flex items-center justify-center p-4" onClick={() => setShowVaultTools(false)}>
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-3xl shadow-2xl relative overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-800/20">
                <div className="flex items-center gap-4"><div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20"><Key className="text-emerald-400" size={24} /></div><div><h3 className="text-xl font-black text-white uppercase tracking-tighter">Vault Cryptographic Processor</h3><p className="text-[10px] text-slate-500 font-mono uppercase mt-1">RGB_Visual / Secret Note Stream</p></div></div>
                <button onClick={() => setShowVaultTools(false)} className="text-slate-500 hover:text-white"><X size={28} /></button>
              </div>
              <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => { setVaultToolMode('encrypt'); setVaultDecryptedText(''); setVaultDecryptedImage(null); }} className={`p-4 rounded-2xl font-bold uppercase tracking-widest transition-all border ${vaultToolMode === 'encrypt' ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>Encryption</button>
                  <button onClick={() => { setVaultToolMode('decrypt'); setVaultDecryptedText(''); setVaultDecryptedImage(null); }} className={`p-4 rounded-2xl font-bold uppercase tracking-widest transition-all border ${vaultToolMode === 'decrypt' ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>Decryption</button>
                </div>
                <div className="flex items-center gap-6 pb-2">
                  <button onClick={() => setVaultDataType('text')} className={`flex items-center gap-2 text-xs font-bold uppercase transition-colors ${vaultDataType === 'text' ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}><FileText size={16} /> Secret Note</button>
                  <button onClick={() => setVaultDataType('image')} className={`flex items-center gap-2 text-xs font-bold uppercase transition-colors ${vaultDataType === 'image' ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}><ImageIcon size={16} /> Image PNG</button>
                </div>
                <div className="space-y-6">
                  {vaultDataType === 'text' ? (
                    <div className="space-y-4">
                      {vaultToolMode === 'encrypt' ? (
                        <textarea value={vaultTextInput} onChange={(e) => setVaultTextInput(e.target.value)} placeholder="Type content..." className="w-full bg-black/40 border border-slate-800 rounded-3xl p-6 text-sm h-40 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-800 resize-none" />
                      ) : (
                        <div className="space-y-4">
                            <div className="p-6 bg-black/40 border border-slate-800 rounded-3xl border-dashed flex flex-col items-center justify-center text-center cursor-pointer" onClick={() => vaultFileInputRef.current.click()}><Upload className="text-slate-700 mb-2" /><p className="text-[11px] font-mono text-slate-500">{vaultFile ? vaultFile.name : 'Load .mealy'}</p></div>
                            {vaultDecryptedText && <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl"><p className="text-sm text-slate-200 break-words font-medium">{vaultDecryptedText}</p></div>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                        <div className="p-12 bg-black/40 border border-slate-800 rounded-[2rem] border-dashed flex flex-col items-center justify-center text-center cursor-pointer" onClick={() => vaultFileInputRef.current.click()}><ImageIcon size={48} className="text-slate-800 mb-4" /><p className="text-sm font-bold text-white uppercase tracking-tighter">{vaultFile ? vaultFile.name : 'Select Color Image'}</p></div>
                        {vaultDecryptedImage && <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl text-center"><img src={vaultDecryptedImage} className="mx-auto rounded-xl border border-white/10 max-h-64 shadow-2xl" alt="Decrypted" /></div>}
                    </div>
                  )}
                  <input type="file" ref={vaultFileInputRef} className="hidden" onChange={(e) => setVaultFile(e.target.files[0])} />
                </div>
                <button onClick={processVaultAction} disabled={vaultProcessing || (vaultDataType !== 'text' && !vaultFile)} className={`w-full py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-30 ${vaultToolMode === 'encrypt' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                  {vaultProcessing ? <RefreshCcw size={16} className="animate-spin" /> : (vaultToolMode === 'encrypt' ? <Lock size={16} /> : <RefreshCcw size={16} />)}
                  {vaultToolMode === 'encrypt' ? 'Initialize_Encryption' : 'Execute_Decryption'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Visual Analysis Modal */}
        {selectedImage && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-6" onClick={() => setSelectedImage(null)}>
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 max-w-5xl w-full shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedImage(null)} className="absolute top-8 right-10 text-3xl text-slate-500 hover:text-white transition-colors">✕</button>
              <h3 className="text-2xl font-black text-white tracking-tighter flex items-center justify-center gap-4 mb-10"><Activity className="text-emerald-400" />VISUAL ENTROPY ANALYSIS</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-10">
                <div className="space-y-4 text-center"><div className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/5 py-2 rounded-xl">Original_Color_Payload</div><img src={selectedImage.imageData} className="w-full rounded-2xl border border-white/5 shadow-2xl" /></div>
                <div className="space-y-4 text-center"><div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/5 py-2 rounded-xl">Encrypted_Cipher_Visual</div><img src={selectedImage.encryptedImageData} className="w-full rounded-2xl border border-white/5 shadow-2xl contrast-125" /></div>
              </div>
              <div className="bg-slate-800/50 rounded-[2.5rem] p-8 border border-white/5 grid grid-cols-2 md:grid-cols-4 gap-8">
                  <div><div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Dimensions</div><div className="text-lg font-black text-white">{selectedImage.width} × {selectedImage.height}</div></div>
                  <div><div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Total_RGB_Units</div><div className="text-lg font-black text-white">{selectedImage.originalPixels.length.toLocaleString()}</div></div>
                  <div><div className="text-[9px] font-bold text-orange-500 uppercase mb-1">Time Delay</div><div className="text-lg font-black text-orange-400">{selectedImage.procTime}ms</div></div>
                  <div><div className="text-[9px] font-bold text-emerald-500 uppercase mb-1">Shannon_Entropy</div><div className="text-lg font-black text-emerald-400">{calculateEntropy(selectedImage.encryptedPixels)}</div></div>
              </div>
            </div>
          </div>
        )}
      </div>
      {inspectingTrajectory && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55]" onClick={() => setInspectingTrajectory(null)} />}
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; } .scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

export default App;