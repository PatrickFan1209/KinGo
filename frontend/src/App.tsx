import React, { useState, useEffect, useRef } from 'react';

// ==========================================
// 【🛠️ 請在這裡直接設定您正確的後端連線網址】
// ==========================================
const API_BASE_URL = 'http://127.0.0.1:8000';
const WS_BASE_URL = 'ws://127.0.0.1:8000';
// ==========================================

type Screen = 'welcome' | 'login_method' | 'upload_inbody' | 'app_main';
type Tab = 'home' | 'circle' | 'upload' | 'profile';

interface LiveNotification {
  isOpen: boolean;
  fromUser: string;
  message: string;
}

export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [isLoginMode, setIsLoginMode] = useState<boolean>(true); 
  const [username, setUsername] = useState<string>('');
  const [gender, setGender] = useState<string>('male');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [lobbyFeed, setLobbyFeed] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [liveNotify, setLiveNotify] = useState<LiveNotification>({
    isOpen: false,
    fromUser: '',
    message: ''
  });

  const wsRef = useRef<WebSocket | null>(null);

  const [inbodyForm, setInbodyForm] = useState({
    weight: '',
    fatMass: '',
    skeletalMuscle: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [dailyForm, setDailyForm] = useState({
    weight: '',
    fatMass: '',
    skeletalMuscle: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [witnessModal, setWitnessModal] = useState({
    isOpen: false,
    targetUser: '',
    message: ''
  });

  const [votedUsers, setVotedUsers] = useState<string[]>([]);

  // WebSocket 連線邏輯（已還原並保留見證通知）
  useEffect(() => {
    if (screen === 'app_main' && username) {
      const wsUrl = `${WS_BASE_URL}/api/v1/ws/${encodeURIComponent(username)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'witness_notification') {
            setLiveNotify({
              isOpen: true,
              fromUser: data.from_user,
              message: data.message
            });
            fetchLobbyFeed();
          }
        } catch (err) {
          console.error("解析即時通知訊息失敗", err);
        }
      };
      return () => ws.close();
    }
  }, [screen, username]);

  const fetchLobbyFeed = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/lobby/feed`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setLobbyFeed(data);
      }
    } catch (err) {
      console.error("無法連線至後端", err);
    }
    setTimeout(() => setIsRefreshing(false), 400);
  };

  useEffect(() => {
    if (screen === 'app_main') {
      fetchLobbyFeed();
    }
  }, [screen, currentTab]);

  const getJoinedDays = () => {
    if (!userProfile?.history || userProfile.history.length === 0) return 1;
    const registerDateStr = userProfile.history[0].date;
    const regDate = new Date(registerDateStr);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - regDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  };

  const handleCheckLogin = async () => {
    if (!username.trim()) {
      alert("請先輸入您的暱稱喔！");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/users/login/${encodeURIComponent(username)}`);
      const data = await res.json();
      
      if (isLoginMode) {
        if (data.status === 'success') {
          setUserProfile(data.user_data);
          setScreen('app_main');
          setCurrentTab('home');
        } else {
          alert("此帳號未註冊！");
        }
      } else {
        if (data.status === 'success') {
          alert("此暱稱已被註冊！");
        } else {
          setScreen('upload_inbody');
        }
      }
    } catch (err) {
      alert("系統連線失敗，請確認後端運行中且處於同個 Wi-Fi");
    }
  };

  const handlePhotoClick = () => {
    alert("AI 雲端辨識維護中，請手動輸入。");
  };

  // 註冊功能（保持不動）
  const handleFinalSubmit = async () => {
    if (!inbodyForm.weight || !inbodyForm.fatMass || !inbodyForm.skeletalMuscle) {
      alert("請完整填寫所有數據欄位！");
      return;
    }

    const w = parseFloat(inbodyForm.weight);
    const f = parseFloat(inbodyForm.fatMass);
    const m = parseFloat(inbodyForm.skeletalMuscle);
    const calculatedBfRatio = Math.round((f / w) * 100) || 20;

    const requestBody = {
      username: username,
      gender: gender || "male",
      height: 175.0,
      weight: w,
      skeletalMuscle: m, 
      fatMass: f,        
      bf_ratio: calculatedBfRatio, 
      date: inbodyForm.date
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setUserProfile(data.user_data);
        setScreen('app_main');
        setCurrentTab('home'); 
      } else {
        alert("註冊失敗：" + (JSON.stringify(data.detail) || "格式不正確"));
      }
    } catch (err) {
      alert("網路連線異常，無法完成註冊");
    }
  };

  const openWitnessDialog = (targetUser: string) => {
    if (votedUsers.includes(targetUser)) {
      alert("您已經見證過這位夥伴囉！");
      return;
    }
    setWitnessModal({ isOpen: true, targetUser: targetUser, message: '' });
  };

  const submitWitnessMessage = () => {
    const target = witnessModal.targetUser;
    const msgText = witnessModal.message || '一起加油！';

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'send_witness',
        from_user: username,
        target_user: target,
        message: msgText
      }));
    }

    setLobbyFeed(prev => prev.map(user => {
      if (user.username === target) return { ...user, witness_count: user.witness_count + 1 };
      return user;
    }));
    setVotedUsers([...votedUsers, target]);
    setWitnessModal({ isOpen: false, targetUser: '', message: '' });
  };

  // 🎯 自動路由探測機制（完全依照您原本的寫法，不動任何邏輯與排版）
  const handleDailyUpdateSubmit = async () => {
    if (!dailyForm.weight || !dailyForm.fatMass || !dailyForm.skeletalMuscle) {
      alert("請完整填寫所有數據欄位！");
      return;
    }

    const uw = parseFloat(dailyForm.weight);
    const uf = parseFloat(dailyForm.fatMass);
    const um = parseFloat(dailyForm.skeletalMuscle);
    const uBf = Math.round((uf / uw) * 100) || 18;

    const updateBody = {
      username: username,
      weight: uw,
      skeletalMuscle: um, 
      fatMass: uf,        
      bf_ratio: uBf,      
      date: dailyForm.date
    };

    const candidateUrls = [
      `${API_BASE_URL}/api/v1/users/update/${encodeURIComponent(username)}`,
      `${API_BASE_URL}/api/v1/users/update`,
      `${API_BASE_URL}/api/v1/users/update_data`,
      `${API_BASE_URL}/api/v1/users/update-data`
    ];

    let lastStatus = 404;
    let lastData = null;
    let success = false;

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody)
        });

        lastStatus = res.status;
        lastData = await res.json();

        if (res.ok && lastData.status === 'success') {
          setUserProfile(lastData.user_data);
          success = true;
          break; 
        }
        
        if (res.status !== 404) {
          break; 
        }
      } catch (err) {
        console.error(`嘗試路由失敗: ${url}`, err);
      }
    }

    if (success) {
      alert("數據成功更新！");
      setDailyForm({ weight: '', fatMass: '', skeletalMuscle: '', date: new Date().toISOString().split('T')[0] });
      fetchLobbyFeed(); 
      setCurrentTab('profile'); 
    } else {
      alert(`後端更新失敗 [${lastStatus}]：` + (JSON.stringify(lastData?.detail) || "找不到正確的後端更新網址，請確認後端 Route 定義"));
    }
  };

  const historyList = userProfile?.history || [];
  const latestHistory = historyList.length > 0 ? historyList[historyList.length - 1] : { weight: 0, skeletalMuscle: 0, fatMass: 0, bfRatio: 0, date: '' };
  const firstHistory = historyList.length > 0 ? historyList[0] : { weight: 0, skeletalMuscle: 0, fatMass: 0, bfRatio: 0, date: '' };

  const getSkeletalMuscle = (obj: any) => obj.skeletalMuscle !== undefined ? obj.skeletalMuscle : (obj.skeletal_muscle || 0);
  const getFatMass = (obj: any) => obj.fatMass !== undefined ? obj.fatMass : (obj.fat_mass || 0);
  const getBfRatio = (obj: any) => obj.bfRatio !== undefined ? obj.bfRatio : (obj.bf_ratio || 0);

  const progressWeight = (latestHistory.weight - firstHistory.weight).toFixed(1);
  const progressMuscle = (getSkeletalMuscle(latestHistory) - getSkeletalMuscle(firstHistory)).toFixed(1);
  const progressFat = (getFatMass(latestHistory) - getFatMass(firstHistory)).toFixed(1);

  const firstMuscle = getSkeletalMuscle(firstHistory);
  const firstFat = getFatMass(firstHistory);
  const musclePercent = firstMuscle > 0 ? ((parseFloat(progressMuscle) / firstMuscle) * 100).toFixed(1) : '0.0';
  const fatPercent = firstFat > 0 ? ((parseFloat(progressFat) / firstFat) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
      <div style={{ width: '100%', maxWidth: '375px', height: '760px', background: '#ffffff', borderRadius: '32px', boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.1)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' }}>
        
        {/* 即時通知橫幅 */}
        {liveNotify.isOpen && (
          <div style={{ position: 'absolute', top: '20px', left: '15px', right: '15px', background: 'rgba(255, 255, 255, 0.98)', borderRadius: '16px', padding: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)', zIndex: 9999, color: '#1e293b', border: '1px solid #22c55e', backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#22c55e' }}>🎉 收到新見證！</span>
              <button onClick={() => setLiveNotify({ ...liveNotify, isOpen: false })} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#475569' }}>
              夥伴 <b style={{ color: '#16a34a' }}>{liveNotify.fromUser}</b> 剛剛見證了你的改變：
            </div>
            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', marginTop: '8px', fontSize: '0.85rem', borderLeft: '4px solid #22c55e' }}>
              「 {liveNotify.message} 」
            </div>
          </div>
        )}

        {/* 彈出留言視窗 */}
        {witnessModal.isOpen && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '20px', width: '80%', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#1e293b', fontSize: '1rem' }}>對 <span style={{color:'#22c55e'}}>@{witnessModal.targetUser}</span> 說句鼓勵的話：</h4>
              <input type="text" placeholder="一起加油！持續堅持！" value={witnessModal.message} onChange={e => setWitnessModal({ ...witnessModal, message: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setWitnessModal({ isOpen: false, targetUser: '', message: '' })} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight:'bold' }}>取消</button>
                <button onClick={submitWitnessMessage} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight:'bold' }}>發送見證</button>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 1: 歡迎首頁 */}
        {screen === 'welcome' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff', padding: '32px', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '6.5rem' }}>🏃‍♂️</div>
            <div>
              <div style={{ background: '#f0fdf4', color: '#22c55e', fontSize: '0.75rem', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', display: 'inline-block', marginBottom: '14px', border: '1px solid #bbf7d0' }}>Progress connects us.</div>
              <h1 style={{ fontSize: '3.5rem', margin: '0', fontWeight: '900', color: '#1e293b' }}>KinGo</h1>
              <p style={{ fontSize: '1.05rem', color: '#64748b', margin: '10px 0 32px 0' }}>記錄你的進步，分享你的改變。<br />與同儕攜手見證，讓堅持更有力量。</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button onClick={() => { setIsLoginMode(true); setScreen('login_method'); }} style={{ width: '100%', padding: '16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>登入帳號</button>
                <button onClick={() => { setIsLoginMode(false); setScreen('login_method'); }} style={{ width: '100%', padding: '15px', background: 'transparent', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '14px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>建立新帳號</button>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 2: 暱稱輸入頁 */}
        {screen === 'login_method' && (
          <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', background: '#ffffff', justifyContent: 'space-between' }}>
            <div>
              <div onClick={() => { setScreen('welcome'); setUsername(''); }} style={{ fontSize: '0.9rem', cursor: 'pointer', color: '#94a3b8', marginBottom: '24px', display: 'inline-block' }}>&lt; 返回</div>
              <h2 style={{ fontSize: '2rem', margin: '0', fontWeight: '800', color: '#1e293b' }}>KinGo</h2>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '10px 0 28px 0' }}>
                {isLoginMode ? '請輸入您已註冊的暱稱進行登入：' : '請設定您的新用戶暱稱：'}
              </p>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="請輸入暱稱" style={{ width: '100%', padding: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '14px', fontSize: '1rem', boxSizing: 'border-box', color: '#1e293b' }} />
            </div>
            <button onClick={handleCheckLogin} style={{ width: '100%', padding: '16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
              確認並繼續
            </button>
          </div>
        )}

        {/* PAGE 3: 初始 InBody 數據輸入頁 */}
        {screen === 'upload_inbody' && (
          <div style={{ flex: 1, background: '#ffffff', overflowY: 'auto', display:'flex', flexDirection:'column' }}>
            <div style={{ padding: '32px 24px 16px 24px' }}>
              <div onClick={() => setScreen('login_method')} style={{ fontSize: '0.9rem', cursor: 'pointer', color: '#94a3b8', marginBottom: '12px', display:'inline-block' }}>&lt; 返回</div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#1e293b', margin: '0' }}>建立你的初始檔案</h2>
            </div>
            <div onClick={handlePhotoClick} style={{ margin: '0 24px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '16px', padding: '24px', textAlign: 'center', cursor: 'pointer', color:'#64748b' }}>
                <div style={{fontSize:'1.5rem', marginBottom:'6px'}}>📸</div>
                <div style={{fontSize:'0.85rem', fontWeight:'bold', color:'#475569'}}>拍照上傳 InBody 數據紙</div>
            </div>
            <div style={{ padding: '24px', flex:1, display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <label style={{fontSize:'0.8rem', fontWeight:'bold', color:'#64748b', display:'block', marginBottom:'6px'}}>初始體重 (kg)</label>
                <input type="number" placeholder="例如: 72.3" value={inbodyForm.weight} onChange={e => setInbodyForm({...inbodyForm, weight: e.target.value})} style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', boxSizing:'border-box', color:'#1e293b' }} />
              </div>
              <div>
                <label style={{fontSize:'0.8rem', fontWeight:'bold', color:'#64748b', display:'block', marginBottom:'6px'}}>初始體脂肪重 (kg)</label>
                <input type="number" placeholder="example: 20.6" value={inbodyForm.fatMass} onChange={e => setInbodyForm({...inbodyForm, fatMass: e.target.value})} style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', boxSizing:'border-box', color:'#1e293b' }} />
              </div>
              <div>
                <label style={{fontSize:'0.8rem', fontWeight:'bold', color:'#64748b', display:'block', marginBottom:'6px'}}>初始骨骼肌量 (kg)</label>
                <input type="number" placeholder="example: 26.1" value={inbodyForm.skeletalMuscle} onChange={e => setInbodyForm({...inbodyForm, skeletalMuscle: e.target.value})} style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', boxSizing:'border-box', color:'#1e293b' }} />
              </div>
              <div>
                <label style={{fontSize:'0.8rem', fontWeight:'bold', color:'#64748b', display:'block', marginBottom:'6px'}}>記錄日期</label>
                <input type="date" value={inbodyForm.date} onChange={e => setInbodyForm({...inbodyForm, date: e.target.value})} style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', boxSizing:'border-box', color:'#1e293b' }} />
              </div>
              <button onClick={handleFinalSubmit} style={{ width: '100%', padding: '16px', background: '#22c55e', border: 'none', borderRadius: '14px', color: '#fff', fontWeight:'bold', cursor:'pointer', marginTop:'10px' }}>完成註冊並生成起點卡</button>
            </div>
          </div>
        )}

        {/* APP 主功能區 */}
        {screen === 'app_main' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', height: '100%', overflow: 'hidden' }}>
            <div style={{ flex: 1, padding: '24px 20px', overflowY: 'auto', paddingBottom: '88px' }}>
              
              {/* TAB 1: 起點卡 */}
              {currentTab === 'home' && (
                <div>
                  <h3 style={{ margin: '0 0 6px 0', color: '#1e293b', fontSize: '1.3rem', fontWeight: 'bold' }}>你的起點卡已生成！</h3>
                  <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.85rem' }}>記錄你改變的起點。</p>
                  
                  <div style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', borderRadius: '24px', padding: '24px', color: '#fff', boxShadow:'0 10px 20px rgba(34,197,94,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.85 }}>
                      <span>● DAY 1</span>
                      <span>{latestHistory.date || '2026.06.26'} 建立</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                      <div>
                        <div style={{ fontSize: '1.6rem', fontWeight: '900' }}>我的起點卡</div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '10px', background:'rgba(255,255,255,0.2)', padding:'4px 10px', borderRadius:'20px', display:'inline-block' }}>👤 {userProfile?.username}</div>
                      </div>
                      <div style={{ width: '60px', height: '60px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🐻</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.06)', padding: '16px', borderRadius: '16px', marginTop: '24px' }}>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom:'4px' }}>體重</div><div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{latestHistory.weight} kg</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom:'4px' }}>體脂率</div><div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{getBfRatio(latestHistory)}%</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom:'4px' }}>骨骼肌</div><div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{getSkeletalMuscle(latestHistory)} kg</div></div>
                    </div>
                  </div>
                  <button onClick={() => setCurrentTab('circle')} style={{ width: '100%', padding: '16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 'bold', marginTop: '20px', cursor: 'pointer', fontSize:'0.95rem' }}>進入體態圈</button>
                </div>
              )}

              {/* TAB 2: 體態圈 */}
              {currentTab === 'circle' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ color: '#1e293b', margin: '0', fontSize:'1.25rem', fontWeight: 'bold' }}>同儕體態圈</h3>
                    </div>
                    <span onClick={fetchLobbyFeed} style={{ fontSize: '0.75rem', color: '#22c55e', cursor: 'pointer', background:'#ffffff', padding:'6px 12px', borderRadius:'8px', fontWeight:'600', border:'1px solid #cbd5e1' }}>
                      {isRefreshing ? '🔄 同步中...' : '🔄 整理刷新'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {lobbyFeed.length <= 1 ? (
                      <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', marginTop: '40px' }}>正在等待其他夥伴加入...</p>
                    ) : (
                      lobbyFeed.filter(u => u.username !== username).map((feedUser: any) => {
                        const hasVoted = votedUsers.includes(feedUser.username);
                        const uWDiff = (feedUser.latest.weight - feedUser.initial.weight).toFixed(1);
                        const uMDiff = (getSkeletalMuscle(feedUser.latest) - getSkeletalMuscle(feedUser.initial)).toFixed(1);
                        const uFDiff = (getFatMass(feedUser.latest) - getFatMass(feedUser.initial)).toFixed(1);

                        return (
                          <div key={feedUser.username} style={{ background: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '1.05rem' }}>🔥 {feedUser.username}</span>
                              <span style={{ fontSize: '0.75rem', background: '#f0fdf4', color: '#22c55e', padding: '4px 12px', borderRadius: '20px', fontWeight: '600' }}>👀 見證數 {feedUser.witness_count}</span>
                            </div>
                            
                            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '14px', marginTop: '14px', display: 'flex', justifyContent: 'space-around', fontSize: '0.85rem' }}>
                              <div>體重: <b>{feedUser.latest.weight}kg</b></div>
                              <div>體脂: <b>{getBfRatio(feedUser.latest)}%</b></div>
                              <div>肌肉: <b>{getSkeletalMuscle(feedUser.latest)}kg</b></div>
                            </div>

                            <div style={{ marginTop: '12px', padding: '0 4px', display:'flex', flexDirection:'column', gap:'5px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                <span style={{ color: '#64748b' }}>體重總計</span>
                                <span style={{ fontWeight: 'bold', color: parseFloat(uWDiff) <= 0 ? '#22c55e' : '#ef4444' }}>{parseFloat(uWDiff) > 0 ? `+${uWDiff}` : uWDiff} kg</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                <span style={{ color: '#64748b' }}>肌肉增長</span>
                                <span style={{ fontWeight: 'bold', color: parseFloat(uMDiff) >= 0 ? '#22c55e' : '#ef4444' }}>{parseFloat(uMDiff) > 0 ? `+${uMDiff}` : uMDiff} kg</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                <span style={{ color: '#64748b' }}>脂肪減少</span>
                                <span style={{ fontWeight: 'bold', color: parseFloat(uFDiff) <= 0 ? '#22c55e' : '#ef4444' }}>{parseFloat(uFDiff) > 0 ? `+${uFDiff}` : uFDiff} kg</span>
                              </div>
                            </div>

                            <button onClick={() => openWitnessDialog(feedUser.username)} style={{ width: '100%', marginTop: '14px', padding: '12px', background: hasVoted ? '#e2e8f0' : '#22c55e', color: hasVoted ? '#94a3b8' : '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: hasVoted ? 'default' : 'pointer' }}>
                              {hasVoted ? '見證成功！完美的社群需要你的參與，感謝你為夥伴的自律與汗水大聲喝采！' : '給予S鼓勵，見證改變！'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* 📤 TAB 3: 日常數據更新頁面 */}
              {currentTab === 'upload' && (
                <div>
                  <h3 style={{ margin: '0 0 6px 0', color: '#1e293b', fontSize: '1.25rem', fontWeight: 'bold' }}>日常動態數據更新</h3>
                  <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.85rem' }}>輸入今天的身體量測結果，系統會自動在歷史中記錄並更新體態動態。</p>

                  <div style={{ background: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e2e8f0', display:'flex', flexDirection:'column', gap:'16px' }}>
                    <div>
                      <label style={{fontSize:'0.8rem', fontWeight:'bold', color: '#64748b', display:'block', marginBottom:'6px'}}>目前新體重 (kg)</label>
                      <input type="number" placeholder="example: 85" value={dailyForm.weight} onChange={e => setDailyForm({...dailyForm, weight: e.target.value})} style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#1e293b', boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <label style={{fontSize:'0.8rem', fontWeight:'bold', color: '#64748b', display:'block', marginBottom:'6px'}}>目前新體脂肪重 (kg)</label>
                      <input type="number" placeholder="example: 20" value={dailyForm.fatMass} onChange={e => setDailyForm({...dailyForm, fatMass: e.target.value})} style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#1e293b', boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <label style={{fontSize:'0.8rem', fontWeight:'bold', color: '#64748b', display:'block', marginBottom:'6px'}}>目前新骨骼肌量 (kg)</label>
                      <input type="number" placeholder="example: 23" value={dailyForm.skeletalMuscle} onChange={e => setDailyForm({...dailyForm, skeletalMuscle: e.target.value})} style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#1e293b', boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <label style={{fontSize:'0.8rem', fontWeight:'bold', color: '#64748b', display:'block', marginBottom:'6px'}}>記錄日期</label>
                      <input type="date" value={dailyForm.date} onChange={e => setDailyForm({...dailyForm, date: e.target.value})} style={{ width: '100%', padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#1e293b', boxSizing:'border-box' }} />
                    </div>
                    <button onClick={handleDailyUpdateSubmit} style={{ width: '100%', padding: '14px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '12px', fontWeight:'bold', cursor:'pointer' }}>確認更新數據</button>
                  </div>
                </div>
              )}

              {/* TAB 4: 個人歷史 */}
              {currentTab === 'profile' && (
                <div>
                  <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: '1.25rem', fontWeight: 'bold' }}>個人歷史檔案</h3>
                  <div style={{ background: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '56px', height: '56px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', border:'1px solid #cbd5e1' }}>🐻</div>
                    <div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color:'#1e293b' }}>{userProfile?.username || '未登入'}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop:'2px' }}>堅持記錄第 <span style={{color:'#22c55e', fontWeight:'bold'}}>{getJoinedDays()}</span> 天</div>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', background: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '14px' }}>📊 累計改變幅度</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: '#64748b' }}>體重變化</span>
                        <span style={{ fontWeight: 'bold', color: parseFloat(progressWeight) <= 0 ? '#22c55e' : '#ef4444' }}>{progressWeight} kg</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: '#64748b' }}>肌肉變化</span>
                        <span style={{ fontWeight: 'bold', color: parseFloat(progressMuscle) >= 0 ? '#22c55e' : '#ef4444' }}>{progressMuscle} kg ({musclePercent}%)</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: '#64748b' }}>脂肪變化</span>
                        <span style={{ fontWeight: 'bold', color: parseFloat(progressFat) <= 0 ? '#22c55e' : '#ef4444' }}>{progressFat} kg ({fatPercent}%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* 底部導覽列 */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '72px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingBottom: '12px', zIndex: 999 }}>
              <div onClick={() => setCurrentTab('home')} style={{ textAlign: 'center', cursor: 'pointer', color: currentTab === 'home' ? '#22c55e' : '#94a3b8' }}>
                <div style={{ fontSize: '1.4rem' }}>🪪</div><div style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>起點卡</div>
              </div>
              <div onClick={() => setCurrentTab('circle')} style={{ textAlign: 'center', cursor: 'pointer', color: currentTab === 'circle' ? '#22c55e' : '#94a3b8' }}>
                <div style={{ fontSize: '1.4rem' }}>🤝</div><div style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>體態圈</div>
              </div>
              <div onClick={() => setCurrentTab('upload')} style={{ textAlign: 'center', cursor: 'pointer', color: currentTab === 'upload' ? '#22c55e' : '#94a3b8' }}>
                <div style={{ fontSize: '1.4rem' }}>📤</div><div style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>更新數據</div>
              </div>
              <div onClick={() => setCurrentTab('profile')} style={{ textAlign: 'center', cursor: 'pointer', color: currentTab === 'profile' ? '#22c55e' : '#94a3b8' }}>
                <div style={{ fontSize: '1.4rem' }}>📊</div><div style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>歷史紀錄</div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}