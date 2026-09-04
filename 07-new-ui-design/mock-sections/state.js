class Component extends DCLogic {
  state = { sched:{1:true}, previewOpen:false, previewName:'', shop:0, shopsOpen:false, page:'home', step:1, liveTab:'chat', setTab:'system', isLive:false, confirmStop:false, selLayer:0, selEffect:0, preset:0, shuffle:true, autoReply:true, savePreset:true, liveSec:0, now:Date.now(), themeOverride:null };
  componentDidMount(){ this._t = setInterval(()=>this.setState(s=>({ liveSec: s.isLive ? s.liveSec+1 : s.liveSec, now: Date.now() })),1000); }
  componentWillUnmount(){ clearInterval(this._t); }
  go(p){ this.setState({page:p}); }
  renderVals(){
    const s = this.state;
    const p2 = v=>String(v).padStart(2,'0');
    const fmt = n => p2(Math.floor(n/3600))+':'+p2(Math.floor(n%3600/60))+':'+p2(n%60);
    const d = new Date(s.now);
    const css = str => { const o={}; str.split(';').forEach(r=>{ const i=r.indexOf(':'); if(i<0)return; const k=r.slice(0,i).trim().replace(/-(\w)/g,(_,c)=>c.toUpperCase()); o[k]=r.slice(i+1).trim(); }); return o; };
    const theme = s.themeOverride ?? this.props.theme ?? 'dark';
    const DARK = {"bg":"#0B0D12","side":"#0E1117","surface":"#12151C","surface2":"#1A1F29","hover":"#232C3A","border":"#262D3A","borderHi":"#3B475A","text":"#F2F5F9","muted":"#8A94A6","faint":"#5B6678","navText":"#B8C2D3","tint":"#152238","redTint":"#2A1218","redTint2":"#1C1216","accentHi":"#60A5FA","green":"#3DDC84","redText":"#FF7875","amber":"#F5B83D","greenRgb":"61,220,132","primary":"#1E3A8A","primaryDeep":"#172554","blueRgb":"30,58,138","primaryHover":"#274BA8"}, LIGHT = {"bg":"#F4F6FA","side":"#FFFFFF","surface":"#FFFFFF","surface2":"#EEF2F7","hover":"#E4E9F1","border":"#DDE3EC","borderHi":"#C5CEDB","text":"#111827","muted":"#5B6B85","faint":"#8A96AA","navText":"#4B5566","tint":"#E3E9F5","redTint":"#FDE8E8","redTint2":"#FBEAEA","accentHi":"#1E3A8A","green":"#16A34A","redText":"#DC2626","amber":"#B45309","greenRgb":"22,163,74","primary":"#1E3A8A","primaryDeep":"#172554","blueRgb":"30,58,138","primaryHover":"#274BA8"};
    const T = theme==='light' ? LIGHT : DARK;
    const pageKey = s.page==='control' ? 'setup' : s.page;
    const navItems = [['home','หน้าแรก','⌂'],['setup','ไลฟ์','▶'],['library','คลัง','▤'],['perf','ผลงาน','▥'],['settings','ตั้งค่า','⚙']].map(([key,label,icon])=>({
      label, icon, liveDot: key==='setup' && s.isLive,
      style: css('display:flex;align-items:center;gap:12px;padding:0 14px;height:44px;border-radius:14px;font-size:15px;cursor:pointer;transition:all .15s;'+(pageKey===key?'background:'+T.primary+';color:#fff;font-weight:700;border:1px solid rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 2px 6px rgba('+T.blueRgb+',.3)':'color:'+T.navText+';font-weight:600')),
      onClick: ()=>this.go(key==='setup' ? (s.isLive?'control':'setup') : key) }));
    const stepDefs = [['เตรียมของ','บัญชี · คลิปที่จะวน'],['แต่งหน้าจอ','โลโก้ · นาฬิกา · ข้อความ (ข้ามได้)'],['ยิงไลฟ์','ชื่อไลฟ์ · ตรวจ · เริ่ม']];
    const steps = stepDefs.map(([label,sub],i)=>{ const n=i+1, cur=s.step===n, done=s.step>n; return { label, sub, mark: done?'✓':String(n), onClick: ()=>this.setState({step:n}),
      style: css('display:flex;align-items:center;gap:12px;padding:12px 10px;border-radius:14px;cursor:pointer;'+(cur?'background:'+T.surface2+'':'')),
      numStyle: css('width:34px;height:34px;border-radius:99px;display:grid;place-items:center;font-size:13px;font-weight:700;flex-shrink:0;'+(cur?'background:'+T.primary+';color:#fff':done?'background:rgba('+T.greenRgb+',.15);color:'+T.green+'':'background:'+T.surface2+';color:'+T.muted+'')) }; });
    const toggle = on => ({ track: css('width:44px;height:26px;border-radius:99px;padding:3px;cursor:pointer;transition:background .15s;flex-shrink:0;'+(on?'background:'+T.primary+'':'background:'+T.border+'')), knob: css('width:20px;height:20px;border-radius:99px;background:#fff;transition:transform .15s;'+(on?'transform:translateX(18px)':'')) });
    const sh=toggle(s.shuffle), rp=toggle(s.autoReply), pp=toggle(s.savePreset);
    const presetChips = ['รอบเย็น','รอบดึก'].map((label,i)=>({ label, onClick: ()=>this.setState({preset:i}), style: css('padding:7px 12px;border-radius:999px;font-size:12px;font-weight:600;cursor:pointer;'+(s.preset===i?'background:'+T.primary+';color:#fff':'border:1px solid '+T.border+';color:'+T.muted+'')) }));
    const layerDefs = [['🖼','โลโก้ร้าน','รูปภาพ'],['🕐','นาฬิกา','เวลาจริง'],['🅣','"ส่งฟรี 2 ชิ้น"','ข้อความวิ่ง']];
    const layers = layerDefs.map(([icon,name,kind],i)=>({ icon, name, kind, onClick: ()=>this.setState({selLayer:i}), rowStyle: css('display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:12px;cursor:pointer;min-height:46px;'+(s.selLayer===i?'background:'+T.surface2+';box-shadow:inset 0 0 0 1.5px '+T.primary+'':'')) }));
    const effects = ['ไม่มี','กะพริบ','จางเข้า-ออก','ลอยขึ้น-ลง'].map((label,i)=>({ label, onClick: ()=>this.setState({selEffect:i}), style: css('padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;cursor:pointer;'+(s.selEffect===i?'background:'+T.primary+';color:#fff':'background:'+T.surface2+';color:'+T.muted+'')) }));
    const liveTabs = [['chat','แชท'],['pin','สินค้า'],['sales','ยอดขาย']].map(([k,label])=>({ label, onClick: ()=>this.setState({liveTab:k}), style: css('height:36px;padding:0 18px;border:none;border-radius:10px;font-size:13.5px;cursor:pointer;font-family:inherit;'+(s.liveTab===k?'background:'+T.primary+';color:#fff;font-weight:700':'background:none;color:'+T.muted+'')) }));
    const setTabs = [['system','ระบบ'],['line','แจ้งเตือน LINE'],['ai','แชท AI'],['admin','แอดมิน 🔒']].map(([k,label])=>({ label, onClick: ()=>this.setState({setTab:k}), style: css('height:44px;padding:0 14px;border:none;border-radius:12px;font-size:14px;cursor:pointer;font-family:inherit;text-align:left;'+(s.setTab===k?'background:'+T.surface2+';color:'+T.accentHi+';font-weight:700':'background:none;color:'+T.muted+'')) }));
    const chatMsgs = [['user','nook_x','ตัวนี้เท่าไหร่','18:42'],['bot','ตอบแล้ว','ชิ้นละ 199 บาทค่ะ ✨','0.4 วิ'],['user','mai.shop','ส่งฟรีไหมคะ','18:42'],['bot','ตอบแล้ว','ซื้อครบ 2 ชิ้นส่งฟรีค่ะ','0.3 วิ'],['user','beam_88','มีสีอื่นไหม','18:43'],['ai','AI ตอบ','ตอนนี้มีสีขาวกับชมพูค่ะ กดตะกร้าหมายเลข 2 ได้เลยนะคะ','1.1 วิ']].map(([kind,who,text,meta])=>({ who, text, meta, rowStyle: css('display:flex;'+(kind==='user'?'justify-content:flex-start':'justify-content:flex-end')), bubbleStyle: css('max-width:70%;padding:9px 14px;border-radius:16px;'+(kind==='user'?'background:'+T.surface2+';border-bottom-left-radius:4px':kind==='bot'?'background:'+T.primary+';color:#fff;border-bottom-right-radius:4px':'background:'+T.text+';color:'+T.bg+';border-bottom-right-radius:4px')) }));
    const stMap = { pinning:['● กำลังปัก','color:'+T.green+'','ปักเลย'], queue:['○ รอคิว','color:'+T.muted+'','ปักเลย'], skip:['⊘ ข้ามไว้','color:'+T.faint+'','ใส่กลับ'] };
    const products = [['ครีมบำรุงผิว','pinning'],['เซรั่มหน้าใส','queue'],['โฟมล้างหน้า','skip']].map(([name,st],i)=>({ n:i+1, name, st:stMap[st][0], btn:stMap[st][2], stStyle: css('font-size:12px;font-weight:600;width:84px;'+stMap[st][1]), btnStyle: css('height:36px;padding:0 14px;border-radius:10px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;'+(st==='pinning'?'border:1px solid rgba(255,255,255,.08);background:'+T.primary+';color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)':'border:1px solid '+T.border+';background:none;color:'+T.text+'')) }));
    const history = [['1 ก.ย. 18:02','ร้านหลัก','2:14 ชม.','ok','จบปกติ','12,400 ฿'],['1 ก.ย. 10:30','ร้านสอง','1:02 ชม.','err','ผิดพลาด','—'],['31 ส.ค. 19:15','ร้านหลัก','3:40 ชม.','ok','จบปกติ','21,800 ฿'],['30 ส.ค. 18:00','ร้านหลัก','2:55 ชม.','ok','จบปกติ','15,200 ฿']].map(([date,acc,dur,k,st,gmv])=>({ date, acc, dur, st, gmv, dotStyle: css('width:8px;height:8px;border-radius:99px;'+(k==='ok'?'background:'+T.green+'':'background:#FF5A52')), stStyle: css('font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;'+(k==='ok'?'background:rgba('+T.greenRgb+',.12);color:'+T.green+'':'background:rgba(255,90,82,.12);color:'+T.redText+'')) }));
    const shopDefs = [['ร้านหลัก','mystore.official','สกินแคร์','live'],['บ้านสวนผลไม้','baansuan.fruit','ผลไม้สด','ready'],['เสื้อผ้าแฟชั่นนุ่น','noon.fashion','เสื้อผ้า','ready'],['ครัวคุณแม่','mae.kitchen','อาหารแช่แข็ง','ready'],['กาแฟดอยช้าง','doichang.coffee','เครื่องดื่ม','ready'],['เครื่องสำอางพิม','pim.cosmetics','เครื่องสำอาง','off'],['ของเล่นเด็กจอย','joy.toys','ของเล่น','ready'],['เคสมือถือบอส','boss.case','อุปกรณ์มือถือ','ready'],['สมุนไพรไทยแท้','thai.herb','สุขภาพ','off'],['รองเท้ากีฬาเอ็ม','m.sneaker','รองเท้า','ready']];
    const colors = [''+T.primary+'','#F59E0B','#EC4899','#EF4444','#8B5CF6','#14B8A6','#F97316','#06B6D4','#84CC16','#A855F7'];
    const stM = { live:['● ไลฟ์อยู่','color:'+T.redText+''], ready:['● พร้อม','color:'+T.green+''], off:['○ ยังไม่เชื่อม','color:'+T.faint+''] };
    const shops = shopDefs.map(([name,handle,cat,stk],i)=>({ name, handle, cat, initial:name.slice(0,1), st: stM[stk][0], onClick: ()=>this.setState({shop:i}),
      avStyle: css('width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;background:'+colors[i]),
      rowStyle: css('display:flex;align-items:center;gap:12px;padding:10px 10px;border-radius:12px;cursor:pointer;flex-shrink:0;transition:background .15s;'+(s.shop===i?'background:'+T.surface2+'':'')),
      stStyle: css('font-size:11px;font-weight:600;flex-shrink:0;'+stM[stk][1]) }));
    return {
      shops, shopCount: shops.length, curShop: shops[s.shop],
      curCardStyle: css('border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;border:1px solid;'+(s.isLive?'background:linear-gradient(160deg,'+T.redTint+','+T.surface+');border-color:rgba(255,77,79,.45);box-shadow:0 0 0 1px rgba(255,77,79,.15),0 10px 30px rgba(255,77,79,.15)':'background:linear-gradient(160deg,'+T.tint+','+T.surface+');border-color:'+T.primary+';box-shadow:0 10px 30px rgba('+T.blueRgb+',.18)')),
      curStatusStyle: css('display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:10px;font-size:13px;font-weight:700;'+(s.isLive?'background:rgba(255,77,79,.15);color:'+T.redText+'':'background:rgba('+T.greenRgb+',.12);color:'+T.green+'')),
      curDotStyle: css('width:9px;height:9px;border-radius:99px;'+(s.isLive?'background:#FF4D4F;animation:livePulse 1.2s infinite;box-shadow:0 0 10px rgba(255,77,79,.8)':'background:'+T.green+';box-shadow:0 0 8px rgba('+T.greenRgb+',.6)')),
      curStatusText: s.isLive ? 'กำลังไลฟ์อยู่ · '+fmt(s.liveSec) : 'พร้อมไลฟ์ · ว่างอยู่',
      curAcctSub: shopDefs[s.shop][3]==='off' ? 'ยังไม่เชื่อม TikTok · กดเชื่อมต่อ' : 'TikTok เชื่อมแล้ว · '+shopDefs[s.shop][2]+' · พร้อมไลฟ์', curAcctSubStyle: css('font-size:11.5px;'+(shopDefs[s.shop][3]==='off'?'color:'+T.amber+'':'color:'+T.green+'')), toggleShops: ()=>this.setState(st=>({shopsOpen:!st.shopsOpen})),
      shopsHint: s.shopsOpen ? 'กดเพื่อซ่อน' : 'กดเพื่อเลือก', chevStyle: css('color:'+T.faint+';font-size:14px;transition:transform .3s;'+(s.shopsOpen?'transform:rotate(180deg)':'')),
      shopsPanelStyle: css('display:flex;flex-direction:column;overflow:hidden;min-height:0;transition:opacity .35s,transform .4s cubic-bezier(.22,1,.36,1);'+(s.shopsOpen?'flex:1;opacity:1;transform:translateY(0)':'height:0;opacity:0;transform:translateY(24px);pointer-events:none')),
      bottomInfoStyle: css('display:flex;flex-direction:column;gap:8px;flex-shrink:0;'+(s.shopsOpen?'display:none':'')),
      sideTopStyle: css('display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;'+(s.shopsOpen?'display:none':'')),
      themeBtnStyle: css('margin-top:10px;height:38px;border:1px solid '+T.border+';border-radius:12px;background:none;color:'+T.muted+';font-size:12.5px;font-weight:600;cursor:pointer;flex-shrink:0;'+(s.shopsOpen?'display:none':'')),
      shopBlockStyle: css('display:flex;flex-direction:column;min-height:0;'+(s.shopsOpen?'flex:1;order:1':'margin-top:10px;border-top:1px solid '+T.surface2+';padding-top:10px')),
      shopsTitle: s.shopsOpen ? 'กดพับร้านค้า' : 'กดดูร้านค้า',
      T, themeStyle: theme==='light' ? {height:'100vh', background:'#F4F6FA'} : {height:'100vh'},
      themeLabel: theme==='light' ? '🌙 โหมดมืด' : '☀️ โหมดสว่าง',
      toggleTheme: ()=>this.setState({themeOverride: theme==='light'?'dark':'light'}),
      navItems, steps, layers, effects, liveTabs, setTabs, chatMsgs, products, history, presetChips,
      clock: p2(d.getHours())+':'+p2(d.getMinutes()),
      weekBars: [[40,'จ.'],[65,'อ.'],[30,'พ.'],[80,'พฤ.'],[55,'ศ.'],[90,'ส.'],[70,'อา.']].map(([v,label],i)=>({label, style:css('width:100%;max-width:44px;height:'+v+'%;border-radius:6px 6px 2px 2px;background:'+(i===5?''+T.primary+'':''+T.border+''))})),
      perfBars: [30,45,25,60,40,75,55,35,80,65,50,90,70,60].map((v,i)=>({style:css('width:100%;height:'+v+'%;border-radius:6px 6px 2px 2px;background:'+(i===11?''+T.accentHi+'':''+T.primary+'')+';opacity:'+(i===11?1:.6))})),
      eqBars: [0,1,2,3,4,5].map(i=>({style:css('width:4px;height:100%;border-radius:99px;background:'+T.accentHi+';transform-origin:bottom;animation:eq '+(0.7+i*0.13)+'s ease-in-out infinite;animation-delay:'+(i*0.1)+'s')})),
      salesBars: [3,5,2,8,6,9,4,7,10,6,5,8,12,9,7,11,8,6,9,14].map((v,i)=>({style:css('flex:1;height:'+(v*7)+'%;border-radius:4px 4px 0 0;background:'+(i===19?''+T.accentHi+'':''+T.border+''))})),
      clips: [['promo-a.mp4','1:20','18:00'],['promo-b.mp4','0:45','19:30'],['promo-c.mp4','2:10','21:00']].map(([name,dur,time],i)=>{ const on=!!s.sched[i+1]; return {n:i+1,name,dur,time, sched:on, noSched:!on, preview: ()=>this.setState({previewOpen:true, previewName:name}), toggleSched: ()=>this.setState(st=>({sched:{...st.sched,[i+1]:!st.sched[i+1]}})), schedStyle: css('width:30px;height:18px;border-radius:99px;padding:2px;cursor:pointer;display:inline-block;transition:background .15s;flex-shrink:0;'+(on?'background:'+T.primary+'':'background:'+T.border+'')), schedKnob: css('display:block;width:14px;height:14px;border-radius:99px;background:#fff;transition:transform .15s;'+(on?'transform:translateX(12px)':''))}; }),
      previewOpen: s.previewOpen, previewName: s.previewName, closePreview: ()=>this.setState({previewOpen:false}),
      libClips: [['promo-a.mp4','1:20'],['promo-b.mp4','0:45'],['promo-c.mp4','2:10'],['unbox-1.mp4','1:05']].map(([name,dur])=>({name,dur})),
      preflight: [['บัญชี','mystore.official'],['คลิป','3 คลิป · สุ่มลำดับ'],['หน้าจอ','3 layer'],['ปลายทาง','TikTok อัตโนมัติ'],['คุณภาพ','6 Mbps · NVENC'],['ระหว่างไลฟ์','ตอบแชท + ปักสินค้า']].map(([k,v])=>({k,v})),
      isHome: s.page==='home', isSetup: s.page==='setup', isControl: s.page==='control', isLibrary: s.page==='library', isPerf: s.page==='perf', isSettings: s.page==='settings',
      isStep1: s.step===1, isStep2: s.step===2, isStep3: s.step===3, notStep1: s.step>1, showStepFooter: s.step<3,
      tabChat: s.liveTab==='chat', tabPin: s.liveTab==='pin', tabSales: s.liveTab==='sales',
      setSystem: s.setTab==='system', setLine: s.setTab==='line', setAiTab: s.setTab==='ai', setAdmin: s.setTab==='admin',
      selLayerName: layerDefs[s.selLayer][1], elapsed: fmt(s.liveSec),
      liveHeaderPill: s.isLive && s.page!=='control', confirmStop: s.confirmStop,
      shuffleTrackStyle: sh.track, shuffleKnobStyle: sh.knob, replyTrackStyle: rp.track, replyKnobStyle: rp.knob, presetTrackStyle: pp.track, presetKnobStyle: pp.knob,
      replyLabel: s.autoReply ? 'ตอบอัตโนมัติ เปิดอยู่' : 'ตอบอัตโนมัติ ปิดอยู่',
      goLiveSetup: ()=>this.setState({page:'setup', step:1}), goPerf: ()=>this.go('perf'), goLibrary: ()=>this.go('library'), goControl: ()=>this.go('control'),
      goStep3: ()=>this.setState({step:3}), nextStep: ()=>this.setState(st=>({step:Math.min(3,st.step+1)})), prevStep: ()=>this.setState(st=>({step:Math.max(1,st.step-1)})),
      startLive: ()=>this.setState({isLive:true, page:'control', liveSec:0, liveTab:'chat'}),
      askStop: ()=>this.setState({confirmStop:true}), cancelStop: ()=>this.setState({confirmStop:false}),
      confirmStopLive: ()=>this.setState({confirmStop:false, isLive:false, page:'home'}),
      toggleShuffle: ()=>this.setState(st=>({shuffle:!st.shuffle})), toggleReply: ()=>this.setState(st=>({autoReply:!st.autoReply})), togglePreset: ()=>this.setState(st=>({savePreset:!st.savePreset}))
    };
  }
}