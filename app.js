/**
 * app.js - 312110 ❤️ Pager & Video Call PWA
 * Full Supabase Realtime, WebRTC Video, & VAPID Push Notifications implementation
 * Strict Rule: NO native browser alert(), confirm(), or prompt() used.
 */

// =========================================================================
// MANUAL BACKEND CONFIGURATION INSTRUCTIONS:
// 1. Go to https://supabase.com and sign in to your project dashboard.
// 2. Click the gear/settings icon (⚙️ Project Settings) in the bottom left sidebar.
// 3. Click on "Data API" (or "API") under Configuration.
// 4. Copy your "Project URL" into MANUAL_SUPABASE_URL below.
// 5. Under "Project API keys", copy your "anon / public" key into MANUAL_SUPABASE_ANON_KEY below.
// Note: If left empty (""), the app runs smoothly in local/broadcast P2P mode!
// =========================================================================
const MANUAL_SUPABASE_URL = "https://fwwvksyewbdfdyegzgfz.supabase.co"; // e.g., "https://abcdefghijklmnop.supabase.co"
const MANUAL_SUPABASE_ANON_KEY = "sb_publishable_IED8Q0cnxphV6LWsaOV9cg_qChpAX8H"; // e.g., "eyJhbGciOi..."
const MANUAL_VAPID_PUBLIC_KEY = "BKN-p8vqsDGJ2jBjJwgO4QFjerXfPkDAUD6Gk9EAyMlnvOKWtV11UlvzHoC6TqFEXc3nas87Wqq3sjsE7lBYh7I"; // e.g., "BEl62iUYgUivxIkv69yViEuiBIa-..."
const DEFAULT_SUPABASE_URL = "";

function boostSdpBitrate(sdp) {
  if (!sdp) return sdp;
  let lines = sdp.split('\r\n');
  let newLines = [];
  let videoSection = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.startsWith('m=video')) {
      videoSection = true;
    } else if (line.startsWith('m=')) {
      videoSection = false;
    }
    newLines.push(line);
    if (videoSection && (line.startsWith('c=') || line.startsWith('a=mid'))) {
      newLines.push('b=AS:8000'); // 8 Mbps
      newLines.push('b=TIAS:8000000');
    }
  }
  return newLines.join('\r\n');
}

// State Management
const state = {
  supabase: null,
  roomCode: '',
  userName: 'Sweetheart',
  channel: null,
  localStream: null,
  peerConnection: null,
  isCalling: false,
  isMuted: false,
  isCamOff: false,
  isScreenSharing: false,
  enlargedPane: null,
  isImmersiveMode: false,
  activeTheme: 'slate',
  lastInteractionTime: 0,
  screenStream: null,
  ttsEnabled: false,
  circleSpeechEnabled: true,
  pushSubscription: null,
  activitiesCount: 0,
  unreadCount: 0,
  peerConnections: {},
  remoteStreams: {},
  primaryPeer: null
};

// Google STUN Servers for reliable P2P WebRTC connection
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// UI DOM Elements
const elements = {
  toastContainer: document.getElementById('toast-container'),
  statusBadge: document.getElementById('status-badge'),
  loginView: document.getElementById('login-view'),
  dashboardView: document.getElementById('dashboard-view'),
  roomCodeInput: document.getElementById('room-code-input'),
  userNameInput: document.getElementById('user-name-input'),
  joinBtn: document.getElementById('join-btn'),
  enablePushBtn: document.getElementById('enable-push-btn'),
  enablePushDashBtn: document.getElementById('enable-push-dash-btn'),
  clearRoomMessagesBtn: document.getElementById('clear-room-messages-btn'),
  leaveRoomBtn: document.getElementById('leave-room-btn'),
  currentRoomCode: document.getElementById('current-room-code'),
  giantHeartBtn: document.getElementById('giant-heart-btn'),
  startCallBtn: document.getElementById('start-call-btn'),
  videoUi: document.getElementById('video-ui'),
  remoteVideo: document.getElementById('remote-video'),
  localVideo: document.getElementById('local-video'),
  remoteWaitingOverlay: document.getElementById('remote-waiting-overlay'),
  toggleMuteBtn: document.getElementById('toggle-mute-btn'),
  toggleCamBtn: document.getElementById('toggle-cam-btn'),
  endCallBtn: document.getElementById('end-call-btn'),
  chatFeed: document.getElementById('chat-feed'),
  feedCount: document.getElementById('feed-count'),
  messageForm: document.getElementById('message-form'),
  messageInput: document.getElementById('message-input'),
  roomHeartBtn: document.getElementById('room-heart-btn'),
  notifyCallBtn: document.getElementById('notify-call-btn'),
  callInviteModal: document.getElementById('call-invite-modal'),
  inviteSenderText: document.getElementById('invite-sender-text'),
  acceptCallBtn: document.getElementById('accept-call-btn'),
  declineCallBtn: document.getElementById('decline-call-btn'),
  roomThemeBtn: document.getElementById('room-theme-btn'),
  roomThemeMenu: document.getElementById('room-theme-menu'),
  frontThemeBtn: document.getElementById('front-theme-btn'),
  frontThemeMenu: document.getElementById('front-theme-menu'),
  themeColorBtn: document.getElementById('theme-color-btn'),
  themeMenu: document.getElementById('theme-menu'),
  remoteCamOff: document.getElementById('remote-cam-off'),
  localCamOff: document.getElementById('local-cam-off'),
  toggleCircleSpeechBtn: document.getElementById('toggle-circle-speech-btn'),
  toggleTtsBtn: document.getElementById('toggle-tts-btn'),
  remoteCircleSpeech: document.getElementById('remote-circle-speech'),
  localCircleSpeech: document.getElementById('local-circle-speech'),
  videoPanesWrapper: document.getElementById('video-panes-wrapper'),
  remoteVideoContainer: document.getElementById('remote-video-container'),
  localVideoContainer: document.getElementById('local-video-container'),
  screenShareContainer: document.getElementById('screen-share-container'),
  screenShareVideo: document.getElementById('screen-share-video'),
  videoResizer: document.getElementById('video-resizer'),
  videoChatOverlay: document.getElementById('video-chat-overlay'),
  videoChatFeed: document.getElementById('video-chat-feed'),
  clearVideoMessagesBtn: document.getElementById('clear-video-messages-btn'),
  videoChatForm: document.getElementById('video-chat-form'),
  videoChatInput: document.getElementById('video-chat-input'),
  toggleScreenBtn: document.getElementById('toggle-screen-btn'),
  minimizeVideoChat: document.getElementById('minimize-video-chat'),
  notifUrgeModal: document.getElementById('notif-urge-modal'),
  enableNotifsEnterBtn: document.getElementById('enable-notifs-enter-btn'),
  skipNotifsEnterBtn: document.getElementById('skip-notifs-enter-btn'),
  openSidebarBtnRoom: document.getElementById('open-sidebar-btn-room'),
  openSidebarBtnVideo: document.getElementById('open-sidebar-btn-video'),
  closeSidebarBtn: document.getElementById('close-sidebar-btn'),
  settingsSidebar: document.getElementById('settings-sidebar'),
  sidebarOverlay: document.getElementById('sidebar-overlay'),
  toggleLiveChatBtn: document.getElementById('toggle-live-chat-btn'),
  toggleTtsSidebarBtn: document.getElementById('toggle-tts-sidebar-btn'),
  playTogetherBtn: document.getElementById('play-together-btn'),
};

// Initialize PWA & Service Worker
window.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  setupEventListeners();
  loadSavedCredentials();
});

function showToast(message, type = 'info', duration = 4000) {
  if (type === 'error' && elements.toastContainer) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>⚠️</span> <span>${message}</span>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

function playBeepSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) { /* ignore audio blocked */ }
}

function showNativeNotification(title, body, force = false) {
  playBeepSound();
  if (!force && !document.hidden) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    const options = {
      body: body || 'Open B612 to view your room!',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">❤️</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">❤️</text></svg>',
      vibrate: [200, 100, 200]
    };
    try {
      new Notification(title || 'B612 ❤️', options);
    } catch (e) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title || 'B612 ❤️', options).catch(() => {});
        }).catch(() => {});
      }
    }
  }
}

/**
 * Register Service Worker for PWA and Push Notifications
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js?v=gradient2');
      await reg.update();
      console.log('Service Worker registered successfully:', reg.scope);
    } catch (err) {
      console.warn('Service Worker registration failed:', err);
    }
  }
}

/**
 * Event Listeners Setup
 */
function setupEventListeners() {
  elements.joinBtn?.addEventListener('click', handleJoinRoom);
  elements.roomCodeInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleJoinRoom();
  });
  
  elements.enablePushBtn?.addEventListener('click', () => handleEnablePush());
  elements.enablePushDashBtn?.addEventListener('click', () => handleEnablePush());
  elements.leaveRoomBtn?.addEventListener('click', handleLeaveRoom);
  
  elements.giantHeartBtn?.addEventListener('click', handleSendHeart);
  
  // Room Heart action & Form Submit
  elements.messageForm?.addEventListener('submit', handleRoomFormSubmit);
  elements.roomHeartBtn?.addEventListener('click', handleRoomHeartClick);
  
  // Video Call Invite & Modal
  elements.notifyCallBtn?.addEventListener('click', sendCallInvite);
  elements.acceptCallBtn?.addEventListener('click', acceptCallInvite);
  elements.declineCallBtn?.addEventListener('click', declineCallInvite);
  
  // Video Controls
  elements.startCallBtn?.addEventListener('click', initiateVideoCall);
  elements.endCallBtn?.addEventListener('click', endVideoCall);
  elements.toggleMuteBtn?.addEventListener('click', toggleMute);
  elements.toggleCamBtn?.addEventListener('click', toggleCamera);
  elements.toggleScreenBtn?.addEventListener('click', toggleScreenShare);
  elements.playTogetherBtn?.addEventListener('click', startPlayTogether);
  
  // Sidebar Drawer & Controls
  const openSidebar = () => {
    elements.settingsSidebar?.classList.remove('hidden');
    elements.sidebarOverlay?.classList.remove('hidden');
  };
  const closeSidebar = () => {
    elements.settingsSidebar?.classList.add('hidden');
    elements.sidebarOverlay?.classList.add('hidden');
  };
  elements.openSidebarBtnRoom?.addEventListener('click', openSidebar);
  elements.openSidebarBtnVideo?.addEventListener('click', openSidebar);
  elements.closeSidebarBtn?.addEventListener('click', closeSidebar);
  elements.sidebarOverlay?.addEventListener('click', closeSidebar);

  // Front Page Theme Dropdown Toggle
  elements.frontThemeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.frontThemeMenu?.classList.toggle('hidden');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (elements.frontThemeMenu && !elements.frontThemeMenu.classList.contains('hidden')) {
      if (elements.frontThemeBtn && !elements.frontThemeBtn.contains(e.target) && !elements.frontThemeMenu.contains(e.target)) {
        elements.frontThemeMenu.classList.add('hidden');
      }
    }
  });

  document.querySelectorAll('.theme-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleThemeSelection(e.currentTarget.dataset.theme);
      closeSidebar();
      elements.frontThemeMenu?.classList.add('hidden');
    });
  });

  elements.clearRoomMessagesBtn?.addEventListener('click', () => {
    clearRoomMessages();
    closeSidebar();
  });
  elements.clearVideoMessagesBtn?.addEventListener('click', () => {
    clearVideoMessages();
    closeSidebar();
  });
  
  elements.toggleCircleSpeechBtn?.addEventListener('click', () => toggleCircleSpeech(true));
  elements.toggleTtsBtn?.addEventListener('click', toggleTts);
  elements.toggleTtsSidebarBtn?.addEventListener('click', toggleTts);
  elements.toggleLiveChatBtn?.addEventListener('click', () => {
    elements.videoChatOverlay?.classList.toggle('collapsed');
  });

  // Interactive Click-to-Enlarge & Draggable PiP / Circles
  elements.remoteVideoContainer?.addEventListener('click', () => handlePaneClick('remote'));
  elements.localVideoContainer?.addEventListener('click', () => handlePaneClick('local'));
  setupPaneDragging(elements.remoteVideoContainer);
  setupPaneDragging(elements.localVideoContainer);
  setupPaneResizer(elements.remoteVideoContainer);
  setupPaneResizer(elements.localVideoContainer);
  setupManualResizer();
  window.addEventListener('resize', updateSpeechBubblePositions);

  // Double tap / double click on video UI toggles Fullscreen
  let lastTapTime = 0;
  const dblHandler = (e) => {
    if (e.target?.closest('button') || e.target?.closest('input') || e.target?.closest('.video-chat-form') || e.target?.closest('.video-top-bar') || e.target?.closest('.video-bottom-bar')) return;
    if (document.fullscreenElement || state.isImmersiveMode) exitImmersiveFullscreen(); else toggleImmersiveFullscreen();
  };
  const touchHandler = (e) => {
    if (e.target?.closest('button') || e.target?.closest('input') || e.target?.closest('.video-chat-form') || e.target?.closest('.video-top-bar') || e.target?.closest('.video-bottom-bar')) return;
    const now = Date.now();
    if (now - lastTapTime < 350 && now - lastTapTime > 40) {
      e.preventDefault();
      if (document.fullscreenElement || state.isImmersiveMode) exitImmersiveFullscreen(); else toggleImmersiveFullscreen();
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
  };
  if (elements.videoUi) {
    elements.videoUi.addEventListener('dblclick', dblHandler);
    elements.videoUi.addEventListener('touchend', touchHandler);
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && state.isImmersiveMode) {
      exitImmersiveFullscreen();
    }
  });

  // Push Notifications Pre-Room Modal buttons
  elements.enableNotifsEnterBtn?.addEventListener('click', async () => {
    elements.notifUrgeModal?.classList.add('hidden');
    try {
      await handleEnablePush(false);
    } catch (err) {
      console.warn('Push setup note:', err);
    }
    completeRoomJoin();
  });
  elements.skipNotifsEnterBtn?.addEventListener('click', () => {
    elements.notifUrgeModal?.classList.add('hidden');
    completeRoomJoin();
  });
  
  // Video overlay chat
  elements.videoChatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = elements.videoChatInput?.value.trim();
    if (text) {
      sendChatMessageText(text);
      elements.videoChatInput.value = '';
    }
  });
  elements.minimizeVideoChat?.addEventListener('click', () => {
    const overlay = elements.videoChatOverlay;
    if (!overlay) return;
    const isMinimized = overlay.classList.toggle('minimized');
    if (elements.minimizeVideoChat) {
      elements.minimizeVideoChat.textContent = isMinimized ? '+' : '─';
      elements.minimizeVideoChat.title = isMinimized ? 'Expand Live Chat' : 'Minimize Live Chat';
    }
    if (!isMinimized) clearUnreadMessages();
  });

  const mediaMenuBtn = document.getElementById('media-menu-btn');
  const mediaMenu = document.getElementById('media-menu');
  const mediaPhotoBtn = document.getElementById('media-photo-btn');
  const mediaFileBtn = document.getElementById('media-file-btn');
  const mediaPhotoInput = document.getElementById('media-photo-input');
  const mediaFileInput = document.getElementById('media-file-input');
  
  if (mediaMenuBtn) {
    mediaMenuBtn.addEventListener('click', (e) => {
       e.preventDefault();
       e.stopPropagation();
       mediaMenu.classList.toggle('hidden');
    });
    
    document.addEventListener('click', (e) => {
       if (mediaMenu && !mediaMenu.contains(e.target) && e.target !== mediaMenuBtn) {
          mediaMenu.classList.add('hidden');
       }
    });
  }
  
  if (mediaPhotoBtn) mediaPhotoBtn.addEventListener('click', () => { mediaPhotoInput.click(); mediaMenu.classList.add('hidden'); });
  if (mediaFileBtn) mediaFileBtn.addEventListener('click', () => { mediaFileInput.click(); mediaMenu.classList.add('hidden'); });
  
    const handleMediaUpload = async (e) => {
     const files = e.target.files;
     if (!files || files.length === 0) return;
     for (const file of files) {
        showToast('Encrypting and uploading...', 'info');
        const encryptedBlob = await encryptFile(file);
        
        const buffer = await encryptedBlob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
           binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);
        
        const fileId = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const chunkSize = 250000; // 250KB per chunk
        const totalChunks = Math.ceil(base64Data.length / chunkSize);
        
        if (state.supabase) {
           for (let i = 0; i < totalChunks; i++) {
              const chunkData = base64Data.slice(i * chunkSize, (i + 1) * chunkSize);
              const chunkPayload = JSON.stringify({ fileId, chunkIndex: i, totalChunks, data: chunkData });
              try {
                await state.supabase.from('messages').insert([{
                   room_code: state.roomCode,
                   type: 'media-chunk',
                   content: `${state.userName}: ${chunkPayload}`
                }]);
              } catch(err) { console.error('Chunk upload error', err); }
           }
        }
        
        const payload = {
           type: 'media',
           content: JSON.stringify({ fileId, type: file.type, name: file.name }),
           sender: state.userName,
           timestamp: new Date().toISOString()
        };
        appendFeedItem('media', payload.content, 'You', new Date());
        relaySend(payload);
        
        if (state.supabase) {
           try {
             await state.supabase.from('messages').insert([{
               room_code: state.roomCode,
               type: 'media',
               content: `${state.userName}: ${payload.content}`
             }]);
           } catch(e) {}
        }
     }
     e.target.value = '';
  };
  
  if (mediaPhotoInput) mediaPhotoInput.addEventListener('change', handleMediaUpload);
  if (mediaFileInput) mediaFileInput.addEventListener('change', handleMediaUpload);

  elements.messageInput?.addEventListener('focus', clearUnreadMessages);
  elements.messageInput?.addEventListener('click', clearUnreadMessages);
  elements.videoChatInput?.addEventListener('focus', clearUnreadMessages);
  elements.videoChatInput?.addEventListener('click', clearUnreadMessages);
  window.addEventListener('focus', () => {
    if (!state.inCall || !elements.videoChatOverlay?.classList.contains('minimized')) {
      clearUnreadMessages();
    }
  });
}

function clearUnreadMessages() {
  if (state.unreadCount === 0) return;
  state.unreadCount = 0;
  document.querySelectorAll('.unread-divider').forEach(el => el.remove());
}

function handleRoomHeartClick(e) {
  if (e) e.preventDefault();
  const text = elements.messageInput?.value.trim();
  if (!text) {
    // press heart without text inputted to send notification pager heart
    handleSendHeart();
  } else {
    // if text is present send message with notification
    sendChatMessageText(text);
    if (elements.messageInput) elements.messageInput.value = '';
  }
}

function handleRoomFormSubmit(e) {
  if (e) e.preventDefault();
  handleRoomHeartClick(e);
}

/**
 * Load saved room code or user name from localStorage
 */
function loadSavedCredentials() {
  const savedRoom = localStorage.getItem('b612_room') || localStorage.getItem('lovepager_room');
  const savedName = localStorage.getItem('b612_name') || localStorage.getItem('lovepager_name');
  const savedTheme = localStorage.getItem('b612_theme') || 'slate';
  
  if (savedRoom && elements.roomCodeInput) elements.roomCodeInput.value = savedRoom;
  if (savedName && elements.userNameInput) elements.userNameInput.value = savedName;

  applyTheme(savedTheme, getThemeLabel(savedTheme), false);
}

/**
 * Join Room Logic
 */
async function handleJoinRoom() {
  const roomCode = elements.roomCodeInput?.value.trim().toUpperCase();
  const userName = elements.userNameInput?.value.trim() || 'Sweetheart';
  const sbUrl = MANUAL_SUPABASE_URL;
  const sbKey = MANUAL_SUPABASE_ANON_KEY;
  
  if (!roomCode) {
    showToast('Please enter a Room Code (e.g. SUMMER-92)', 'error');
    return;
  }

  // Save to local storage for quick rejoin
  localStorage.setItem('b612_room', roomCode);
  localStorage.setItem('b612_name', userName);

  state.roomCode = roomCode;
  state.userName = userName;

  // Initialize Supabase Client if manually configured
  try {
    if (window.supabase && sbUrl && sbKey) {
      state.supabase = window.supabase.createClient(sbUrl, sbKey);
    } else {
      console.log('Running in local real-time WebSocket / broadcast mode.');
    }
  } catch (err) {
    console.warn('Supabase init notice:', err);
  }

  // Before entering room, check if push notifications are enabled or prompted
  if ('Notification' in window && Notification.permission !== 'granted' && !state.pushSubscription && elements.notifUrgeModal) {
    elements.notifUrgeModal.classList.remove('hidden');
  } else {
    completeRoomJoin();
  }
}

/**
 * Robust Media Stream Acquisition with fallbacks
 */
async function getOrAcquireLocalStream() {
  if (state.localStream && state.localStream.active) {
    state.localStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
    state.localStream.getVideoTracks().forEach(t => t.enabled = !state.isCamOff);
    if (elements.localVideo && elements.localVideo.srcObject !== state.localStream) {
      elements.localVideo.srcObject = state.localStream;
    }
    updateControlEmojis();
    return state.localStream;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
      audio: true 
    });
    state.localStream = stream;
    stream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
    stream.getVideoTracks().forEach(t => t.enabled = !state.isCamOff);
    if (elements.localVideo) elements.localVideo.srcObject = stream;
    updateControlEmojis();
    return stream;
  } catch (err1) {
    console.warn('Strict video/audio getUserMedia failed, trying relaxed constraints:', err1);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      state.localStream = stream;
      stream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
      stream.getVideoTracks().forEach(t => t.enabled = !state.isCamOff);
      if (elements.localVideo) elements.localVideo.srcObject = stream;
      updateControlEmojis();
      return stream;
    } catch (err2) {
      console.warn('Video+audio failed, trying video only:', err2);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        state.localStream = stream;
        stream.getVideoTracks().forEach(t => t.enabled = !state.isCamOff);
        if (elements.localVideo) elements.localVideo.srcObject = stream;
        updateControlEmojis();
        return stream;
      } catch (err3) {
        console.warn('Video failed, trying audio only:', err3);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          state.localStream = stream;
          stream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
          if (elements.localVideo) elements.localVideo.srcObject = stream;
          updateControlEmojis();
          return stream;
        } catch (err4) {
          console.error('All getUserMedia attempts failed:', err4);
          showToast('Media permissions denied or unavailable. You can still chat.', 'error');
          return null; // Return null to prevent crashing
        }
      }
    }
  }
}

async function completeRoomJoin() {
  // Switch View
  elements.loginView?.classList.remove('active');
  elements.loginView?.classList.add('hidden');
  elements.dashboardView?.classList.remove('hidden');
  if (elements.currentRoomCode) elements.currentRoomCode.textContent = state.roomCode;
  
  if (elements.statusBadge) {
    elements.statusBadge.className = 'status-badge online';
    elements.statusBadge.textContent = 'Online';
  }

  const headerRoomCode = document.getElementById('header-room-code');
  if (headerRoomCode) headerRoomCode.textContent = state.roomCode;

  // Crypto Setup
  await initMyKeyPair();
  const hasKey = await loadRoomKey(state.roomCode);

  // Connect to Realtime Channel
  setupRealtimeSubscription();

  // Load past history if connected to live DB
  loadPastMessages();
  
  if (!hasKey) {
     relaySend({
       type: 'key-request',
       sender: state.userName,
       publicKey: await crypto.subtle.exportKey('jwk', cryptoState.myKeyPair.publicKey)
     });
     setTimeout(() => {
        if (!cryptoState.isEncryptionReady) {
           generateRoomKey(state.roomCode);
        }
     }, 2000);
  }
}

function cleanupRealtimeConnections() {
  if (state.channel) {
    state.channel.unsubscribe();
    state.channel = null;
  }
  if (window.demoBroadcast) {
    try { window.demoBroadcast.close(); } catch (e) {}
    window.demoBroadcast = null;
  }
  if (state.pollInterval) {
    clearInterval(state.pollInterval);
    state.pollInterval = null;
  }
  if (state.storageListener) {
    window.removeEventListener('storage', state.storageListener);
    state.storageListener = null;
  }
}

const seenEventIds = new Set();
function processIncomingRelayEvent(data) {
  if (!data) return;
  const evtId = data.id || `${data.timestamp || ''}_${data.type}_${data.sender}_${data.content || data.theme || data.enabled || ''}`;
  if (seenEventIds.has(evtId)) return;
  seenEventIds.add(evtId);
  if (seenEventIds.size > 500) {
    const first = seenEventIds.values().next().value;
    seenEventIds.delete(first);
  }
  if (data.sender === state.userName) return;
  if (data.signaling || ['offer', 'answer', 'ice-candidate', 'call-invite', 'call-accept', 'call-decline', 'theme-change', 'cam-toggle', 'screen-share-toggle', 'toggle-circle-speech', 'end-call', 'clear-messages', 'clear-video-messages', 'play-together', 'arcade-input', 'arcade-mouse', 'arcade-chat-msg', 'leave-arcade', 'key-request', 'key-response'].includes(data.type)) {
    handleSignalingMessage(data);
  } else {
    handleIncomingPayload(data);
  }
}

/**
 * Leave Room Logic
 */
function handleLeaveRoom() {
  cleanupRealtimeConnections();
  endVideoCall();
  
  elements.dashboardView.classList.add('hidden');
  elements.loginView.classList.remove('hidden');
  elements.loginView.classList.add('active');
  
  if (elements.statusBadge) {
    elements.statusBadge.className = 'status-badge offline';
    elements.statusBadge.textContent = 'Offline';
  }
  showToast('You left the love room.', 'info');
}

/**
 * Setup Supabase Realtime Channel
 */
function setupRealtimeSubscription() {
  cleanupRealtimeConnections();

  // 1. BroadcastChannel for instant local tabs
  window.demoBroadcast = new BroadcastChannel(`b612_${state.roomCode}`);
  window.demoBroadcast.onmessage = (event) => processIncomingRelayEvent(event.data);

  // 2. LocalStorage sync for cross-frame storage events
  state.storageListener = (e) => {
    if (e.key === `b612_relay_${state.roomCode}` && e.newValue) {
      try { processIncomingRelayEvent(JSON.parse(e.newValue)); } catch (err) {}
    }
  };
  window.addEventListener('storage', state.storageListener);

  // 3. HTTP Server Relay for cross-device / cross-browser connection
  state.lastPollId = 0;
  state.pollInterval = setInterval(async () => {
    
    try {
      const res = await fetch(`/api/relay?room=${encodeURIComponent(state.roomCode)}&since=${state.lastPollId}`);
      if (res.ok) {
        const events = await res.json();
        events.forEach(evt => {
          if (evt.id > state.lastPollId) state.lastPollId = evt.id;
          processIncomingRelayEvent(evt);
        });
      }
    } catch (err) {}
  }, 1000);

  if (!state.supabase) {
    return;
  }

  const channelName = `room:${state.roomCode}`;
  state.channel = state.supabase.channel(channelName, {
    config: {
      broadcast: { self: false },
      presence: { key: state.userName }
    }
  });

  state.channel
    .on('broadcast', { event: 'pager_event' }, (payload) => {
      handleIncomingPayload(payload.payload);
    })
    .on('broadcast', { event: 'webrtc_signaling' }, (payload) => {
      handleSignalingMessage(payload.payload);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to Realtime channel: ${channelName}`);
      }
    });
}

/**
 * Handle incoming chat or heart pager payload
 */
async function handleIncomingPayload(data) {
  if (!data) return;
  if (data.signaling || ['offer', 'answer', 'ice-candidate', 'call-invite', 'call-accept', 'call-decline', 'theme-change', 'cam-toggle', 'screen-share-toggle', 'toggle-circle-speech', 'end-call', 'clear-messages', 'clear-video-messages', 'play-together', 'arcade-input', 'arcade-mouse', 'arcade-chat-msg', 'leave-arcade', 'key-request', 'key-response'].includes(data.type)) {
    handleSignalingMessage(data);
    return;
  }
  const { type, content, sender, timestamp } = data;
  if (sender === state.userName) return; // ignore self broadcast echoes
  if (type === 'media-chunk') return;
  
  let decryptedContent = content;
  if (type === 'message') {
     decryptedContent = await decryptMessageContent(content);
  } else if (type === 'media') {
     // content is the media URL or blob info
  }
  
  appendFeedItem(type, decryptedContent, sender || 'Partner', new Date(timestamp || Date.now()));
  
  if (type === 'heart') {
    showToast(`❤️ Heart Page received from ${sender || 'Partner'}!`, 'success');
    showNativeNotification(`❤️ Heart Page!`, `${sender || 'Partner'} sent you a giant heart!`);
  } else if (type === 'message') {
    showToast(`💌 New message from ${sender || 'Partner'}: "${decryptedContent}"`, 'info');
    showNativeNotification(`💌 ${sender || 'Partner'}`, decryptedContent);
  } else if (type === 'media') {
    showToast(`📎 New media from ${sender || 'Partner'}`, 'info');
    showNativeNotification(`📎 ${sender || 'Partner'}`, "Sent a file");
  }
}

/**
 * Load past messages from Supabase 'messages' table
 */
async function loadPastMessages() {
  if (!state.supabase) return;
  try {
    const { data, error } = await state.supabase
      .from('messages')
      .select('*')
      .eq('room_code', state.roomCode)
      .neq('type', 'media-chunk')
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    if (data && data.length > 0) {
      elements.chatFeed.innerHTML = '';
      for (const msg of data) {
        let content = msg.content;
        let sender = content.includes(':') ? content.split(':')[0] : 'Partner';
        let pureContent = content.substring(sender.length + 1).trim();
        if (msg.type === 'message') {
           pureContent = await decryptMessageContent(pureContent);
        }
        appendFeedItem(msg.type, pureContent, sender, new Date(msg.created_at), false);
      }
    }
  } catch (err) {
    console.log('Past history notice (table not yet created or demo project):', err.message);
  }
}

/**
 * Send Heart Page
 */
async function handleSendHeart() {
  const payload = {
    type: 'heart',
    content: '❤️ Sent a giant heart page!',
    sender: state.userName,
    timestamp: new Date().toISOString()
  };

  // Add to local UI
  appendFeedItem('heart', payload.content, 'You', new Date());

  // Broadcast over Supabase Realtime & multi-transport relay
  relaySend(payload);

  // Persist to Supabase database
  if (state.supabase) {
    try {
      await state.supabase.from('messages').insert([{
        room_code: state.roomCode,
        type: 'heart',
        content: `${state.userName}: Sent a heart ❤️`
      }]);
    } catch (e) { /* ignore in demo */ }
  }

  // Trigger Web Push notification to partner via VAPID Vercel/Supabase function
  triggerRemotePushNotification('❤️ Heart Page!', `${state.userName} sent you a giant heart!`);
}

/**
 * Send Custom Chat Message
 */
async function handleSendMessage(e) {
  e?.preventDefault();
  const text = elements.messageInput?.value.trim();
  if (!text) return;
  sendChatMessageText(text);
  if (elements.messageInput) elements.messageInput.value = '';
}

async function sendChatMessageText(text) {
  if (!text) return;

  const encryptedText = await encryptMessageContent(text);
  
  const payload = {
    type: 'message',
    content: encryptedText,
    sender: state.userName,
    timestamp: new Date().toISOString()
  };

  // We append plaintext to our own UI
  appendFeedItem('message', text, 'You', new Date());

  relaySend(payload);

  if (state.supabase) {
    try {
      await state.supabase.from('messages').insert([{
        room_code: state.roomCode,
        type: 'message',
        content: `${state.userName}: ${encryptedText}`
      }]);
    } catch (e) { /* ignore */ }
  }

  triggerRemotePushNotification(`💌 ${state.userName}`, "Encrypted message");
}

/**
 * Append Item to UI Chat Feed
 */
function appendFeedItem(type, content, sender, timeObj, animate = true) {
  if (!elements.chatFeed) return;
  const emptyEl = elements.chatFeed.querySelector('.empty-feed');
  if (emptyEl) emptyEl.remove();

  const item = document.createElement('div');
  const isSelf = sender === 'You' || sender === state.userName;
  const timeStr = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (type === 'heart') {
    item.className = `feed-item heart-event ${animate ? '' : 'no-animate'}`;
    item.innerHTML = `
      <div class="feed-meta"><span>${isSelf ? 'You sent a page' : `Page from <b>${sender}</b>`}</span> <span>${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content" style="font-size: 1.5rem; margin: 4px 0;">❤️❤️❤️</div>
    `;
    showCircleSpeechBubble(isSelf ? 'local' : sender, '❤️❤️❤️');
  } else {
    const cleanContent = content.replace(/^.*?: /, '');
    item.className = `feed-item ${isSelf ? 'self' : 'partner'} ${animate ? '' : 'no-animate'}`;
    
    let innerContent = cleanContent;
    if (type === 'media') {
       try {
           const meta = JSON.parse(cleanContent);
           const uniqueId = 'media-' + Math.random().toString(36).substr(2, 9);
           innerContent = `<div id="${uniqueId}" class="media-container">
               <button class="btn btn-primary" onclick="downloadEncryptedMedia('${meta.fileId}', '${meta.type}', '${meta.name}')">Download ${meta.name}</button>
           </div>`;
           
           // Automatically attempt to decrypt and display inline
           setTimeout(async () => {
              try {
                  const blob = await fetchMediaBlob(meta.fileId, meta.type);
                  if (!blob) throw new Error('Blob not found');
                  const decryptedBlob = await decryptFile(blob, meta.type);
                  const objUrl = URL.createObjectURL(decryptedBlob);
                  const container = document.getElementById(uniqueId);
                  if (container) {
                     if (meta.type.startsWith('image/')) {
                         container.innerHTML = `<img src="${objUrl}" style="max-width: 100%; border-radius: 8px;" alt="media"/>`;
                     } else if (meta.type.startsWith('video/')) {
                         container.innerHTML = `<video src="${objUrl}" controls style="max-width: 100%; border-radius: 8px;"></video>`;
                     } else {
                         container.innerHTML = `<a href="${objUrl}" download="${meta.name}" class="btn btn-primary" style="display:inline-block">Download ${meta.name}</a>`;
                     }
                  }
              } catch (e) { console.error('Media load error', e); }
           }, 100);
       } catch (e) {
           innerContent = `[Encrypted Media]`;
       }
    }
    
    item.innerHTML = `
      <div class="feed-meta"><span class="sender">${isSelf ? 'You' : sender}</span> <span>${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content">${innerContent}</div>
    `;
    if (type !== 'media') showCircleSpeechBubble(isSelf ? 'local' : sender, cleanContent);
  }

  if (isSelf) {
    clearUnreadMessages();
  } else if (animate) {
    const isUnread = document.hidden || (state.inCall && (elements.videoChatOverlay?.classList.contains('minimized') || elements.videoChatOverlay?.classList.contains('hidden')));
    if (isUnread) {
      state.unreadCount = (state.unreadCount || 0) + 1;
      if (state.unreadCount === 1) {
        const divider = document.createElement('div');
        divider.className = 'unread-divider';
        divider.innerHTML = `<span>1 unread message</span>`;
        elements.chatFeed.appendChild(divider);
        if (elements.videoChatFeed) {
          const vDivider = divider.cloneNode(true);
          elements.videoChatFeed.appendChild(vDivider);
        }
      } else {
        document.querySelectorAll('.unread-divider span').forEach(sp => {
          sp.textContent = `${state.unreadCount} unread messages`;
        });
      }
    }
  }

  let vItem = null;
  const delBtn = item.querySelector('.msg-delete-btn');
  delBtn?.addEventListener('click', () => {
    item.remove();
    vItem?.remove();
    state.activitiesCount = Math.max(0, state.activitiesCount - 1);
    if (elements.feedCount) elements.feedCount.textContent = `${state.activitiesCount} message${state.activitiesCount === 1 ? '' : 's'}`;
    showToast('Message deleted');
  });

  elements.chatFeed.appendChild(item);
  elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;

  // Mirror to video chat feed if present
  if (elements.videoChatFeed) {
    vItem = item.cloneNode(true);
    const vDelBtn = vItem.querySelector('.msg-delete-btn');
    vDelBtn?.addEventListener('click', () => {
      item.remove();
      vItem?.remove();
      state.activitiesCount = Math.max(0, state.activitiesCount - 1);
      if (elements.feedCount) elements.feedCount.textContent = `${state.activitiesCount} message${state.activitiesCount === 1 ? '' : 's'}`;
      showToast('Message deleted');
    });
    elements.videoChatFeed.appendChild(vItem);
    elements.videoChatFeed.scrollTop = elements.videoChatFeed.scrollHeight;
  }

  // Text To Speech (TTS) for messages using distinct voices without prefix
  if (state.inCall && state.ttsEnabled && type === 'message' && ('speechSynthesis' in window)) {
    try {
      // Clean off any prefixes or tags completely
      const cleanText = content
        .replace(/^(You say|You|Partner says|Partner|.*? says|.*?:)\s*:?\s*/i, '')
        .replace(/^(You say|this one says)\s*/i, '')
        .trim() || content;
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices() || [];
      if (voices.length > 0) {
        if (isSelf) {
          utterance.voice = voices[0];
          utterance.pitch = 1.12;
          utterance.rate = 1.0;
        } else {
          // Select a distinctly different voice (different name or gender) for partner messages
          const diffVoice = voices.find(v => v.name !== voices[0].name && (v.lang.startsWith('en') || v.lang.startsWith(navigator.language?.slice(0, 2)))) || voices[voices.length - 1];
          if (diffVoice) utterance.voice = diffVoice;
          utterance.pitch = 0.86;
          utterance.rate = 0.95;
        }
      } else {
        utterance.pitch = isSelf ? 1.12 : 0.86;
      }
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('TTS Speech error:', err);
    }
  }

  state.activitiesCount++;
  if (elements.feedCount) {
    elements.feedCount.textContent = `${state.activitiesCount} message${state.activitiesCount === 1 ? '' : 's'}`;
  }
}

/**
 * Start Play Together Arcade Logic
 */
function startPlayTogether() {
  if (!state.roomCode) {
    showToast('You must join a room first!', 'error');
    return;
  }
  showToast('🎮 Launching "Play Together" Arcade overlay...', 'success');
  sendSignaling({ type: 'play-together', sender: state.userName });
  setTimeout(() => {
    initArcadeUI('host');
  }, 1000);
}

/**
 * WebRTC Video Calling Logic
 */
async function initiateVideoCall() {
  if (state.isCalling) return;

  try {
    await getOrAcquireLocalStream();
    if (elements.localVideo && state.localStream) {
      elements.localVideo.srcObject = state.localStream;
      elements.localVideo.play().catch(e => console.debug('localVideo play note:', e));
    }
    elements.videoUi.classList.remove('hidden');
    if (elements.remoteWaitingOverlay) elements.remoteWaitingOverlay.style.display = 'flex';
    state.isCalling = true;

    // Broadcast our join so anyone in the call room will initiate peer connections with us
    sendSignaling({
      type: 'join-call',
      sender: state.userName
    });

    showToast('Entering live video call room...', 'info');
    clearVideoMessages();
    triggerRemotePushNotification('📹 Video Call Room Active!', `${state.userName} joined the live video call!`);

  } catch (err) {
    showToast('Could not access camera/microphone. Please check browser permissions.', 'error');
    console.error('WebRTC media error:', err);
  }
}

function renderRemoteParticipants() {
  const peers = Object.keys(state.remoteStreams || {});
  if (peers.length === 0) {
    if (elements.remoteVideo) elements.remoteVideo.srcObject = null;
    if (elements.remoteWaitingOverlay) elements.remoteWaitingOverlay.style.display = 'flex';
    return;
  }

  if (elements.remoteWaitingOverlay) elements.remoteWaitingOverlay.style.display = 'none';

  if (!state.primaryPeer || !peers.includes(state.primaryPeer)) {
    state.primaryPeer = peers[0];
  }

  if (elements.remoteVideo && elements.remoteVideo.srcObject !== state.remoteStreams[state.primaryPeer]) {
    elements.remoteVideo.srcObject = state.remoteStreams[state.primaryPeer];
    elements.remoteVideo.play().catch(e => console.debug(e));
  }
  const mainLabel = elements.remoteVideoContainer?.querySelector('.pane-label');
  if (mainLabel) mainLabel.textContent = state.primaryPeer;

  const wrapper = elements.videoPanesWrapper;
  if (!wrapper) return;

  peers.forEach(peer => {
    if (peer === state.primaryPeer) {
      const existingExtra = document.getElementById(`remote-container-${peer}`);
      if (existingExtra) existingExtra.remove();
      return;
    }
    let extraPane = document.getElementById(`remote-container-${peer}`);
    if (!extraPane) {
      extraPane = document.createElement('div');
      extraPane.id = `remote-container-${peer}`;
      extraPane.className = 'video-pane remote-pane extra-remote-pane';
      extraPane.style.cssText = 'flex: 50; position: relative;';
      extraPane.innerHTML = `
        <video id="remote-video-${peer}" autoplay playsinline></video>
        <div class="cam-off-placeholder hidden">
          <div class="cam-off-avatar">🧑</div>
          <span class="cam-off-text">${peer} Cam Off</span>
        </div>
        <span class="pane-label">${peer}</span>
        <div class="custom-pane-resizer" title="Drag to resize">↘</div>
      `;
      extraPane.addEventListener('click', () => {
        state.primaryPeer = peer;
        renderRemoteParticipants();
        showToast(`Switched main view to ${peer}`);
      });
      if (typeof setupPaneDragging === 'function') setupPaneDragging(extraPane);
      if (typeof setupPaneResizer === 'function') setupPaneResizer(extraPane);
      wrapper.insertBefore(extraPane, elements.localVideoContainer);
    }
    const vidEl = extraPane.querySelector('video');
    if (vidEl && vidEl.srcObject !== state.remoteStreams[peer]) {
      vidEl.srcObject = state.remoteStreams[peer];
      vidEl.play().catch(e => console.debug(e));
    }
  });

  document.querySelectorAll('.extra-remote-pane').forEach(el => {
    const pName = el.id.replace('remote-container-', '');
    if (!peers.includes(pName) || pName === state.primaryPeer) {
      el.remove();
    }
  });

  if (typeof updateVideoLayout === 'function') updateVideoLayout();
}

function setupPeerConnection(targetPeer = 'partner') {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  if (!state.peerConnections) state.peerConnections = {};
  state.peerConnections[targetPeer] = pc;
  if (targetPeer === 'partner' || !state.peerConnection) {
    state.peerConnection = pc;
  }

  // Add local media tracks
  if (state.localStream) {
    state.localStream.getTracks().forEach(track => {
      pc.addTrack(track, state.localStream);
    });
  }

  // Setup WebRTC Data Channel for arcade keyboard synchronization (Issue 1)
  if (targetPeer === 'partner') {
    if (state.isCalling) {
      try {
        state.arcadeDataChannel = pc.createDataChannel('game-inputs');
        setupArcadeDataChannel(state.arcadeDataChannel);
      } catch (e) {
        console.warn('DataChannel creation failed:', e);
      }
    }
    pc.ondatachannel = (event) => {
      state.arcadeDataChannel = event.channel;
      setupArcadeDataChannel(state.arcadeDataChannel);
    };
  }

  // Handle incoming remote stream
  pc.ontrack = (event) => {
    const track = event.track;
    if (track.kind === 'video' && (track.label?.toLowerCase().includes('screen') || track.label?.toLowerCase().includes('window') || state.partnerScreenSharing)) {
      if (elements.screenShareVideo && elements.screenShareVideo.srcObject !== event.streams[0]) {
        elements.screenShareVideo.srcObject = event.streams[0];
        elements.screenShareVideo.play().catch(e => console.debug(e));
        elements.screenShareContainer?.classList.remove('hidden');
        showToast('Screen share connected! 🖥️', 'success');
      }
    } else {
      if (!state.remoteStreams) state.remoteStreams = {};
      const stream = event.streams[0];
      const mainRemoteStream = state.remoteStreams[targetPeer];
      
      if (mainRemoteStream && stream && mainRemoteStream.id !== stream.id) {
        // This is a secondary stream, i.e., the Arcade Game Stream!
        state.arcadeRemoteStream = stream;
        
        // Update the guest arcade game video display if currently in arcade
        const arcadeGameVideo = document.getElementById('arcade-game-video');
        if (arcadeGameVideo) {
          arcadeGameVideo.srcObject = stream;
          arcadeGameVideo.play().catch(e => console.debug(e));
        }
        showToast('🎮 Game stream connected!', 'success');
      } else {
        // This is the primary webcam stream
        state.remoteStreams[targetPeer] = stream;
        renderRemoteParticipants();
        
        // Also update the arcade remote bubble with the actual webcam stream!
        const arcadeRemoteVideo = document.getElementById('arcade-remote-video');
        if (arcadeRemoteVideo) {
          arcadeRemoteVideo.srcObject = stream;
          arcadeRemoteVideo.play().catch(e => console.debug(e));
        }
        
        showToast(`${targetPeer} connected to video stream! 📹❤️`, 'success');
      }
    }
  };

  // ICE Candidate handling
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignaling({
        type: 'ice-candidate',
        target: targetPeer,
        candidate: event.candidate,
        sender: state.userName
      });
    }
  };

  return pc;
}

function relaySend(payload) {
  if (!payload.timestamp) payload.timestamp = Date.now();
  if (!payload.id) payload.id = Date.now() + Math.random().toString(36).substring(7);

  if (state.channel) {
    try {
      state.channel.send({
        type: 'broadcast',
        event: payload.signaling ? 'webrtc_signaling' : 'pager_event',
        payload: payload
      }).catch(e => console.debug('Supabase send async error:', e));
    } catch (e) {
      console.debug('Supabase send sync error:', e);
    }
  }
  if (window.demoBroadcast) {
    window.demoBroadcast.postMessage(payload);
  }
  try {
    localStorage.setItem(`b612_relay_${state.roomCode}`, JSON.stringify(payload));
  } catch (e) {}
  
  
    fetch(`/api/relay?room=${encodeURIComponent(state.roomCode)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
}

function toggleCircleSpeech(broadcast = true) {
  state.circleSpeechEnabled = !state.circleSpeechEnabled;
  document.body.classList.toggle('circle-speech-on', state.circleSpeechEnabled);
  if (elements.toggleCircleSpeechBtn) {
    elements.toggleCircleSpeechBtn.innerHTML = state.circleSpeechEnabled ? '<span>💭 Circle Speech: On</span>' : '<span>💭 Circle Speech: Off</span>';
    elements.toggleCircleSpeechBtn.classList.toggle('active', state.circleSpeechEnabled);
  }
  if (!state.circleSpeechEnabled) {
    if (elements.remoteCircleSpeech) elements.remoteCircleSpeech.classList.add('hidden');
    if (elements.localCircleSpeech) elements.localCircleSpeech.classList.add('hidden');
  }
  showToast(state.circleSpeechEnabled ? '💭 Circle Speech Bubbles enabled above heads' : '💭 Circle Speech Bubbles disabled');
  if (broadcast) {
    sendSignaling({ type: 'toggle-circle-speech', enabled: state.circleSpeechEnabled, sender: state.userName });
  }
}

function sendSignaling(payload) {
  relaySend({ signaling: true, ...payload });
}

let speechBubbleTimeouts = { local: null, remote: null };

function showCircleSpeechBubble(sender, text) {
  if (state.circleSpeechEnabled === false) return;
  
  const isSelf = sender === 'local' || sender === 'You' || sender === state.userName;
  const bubbleEl = isSelf ? elements.localCircleSpeech : elements.remoteCircleSpeech;
  
  // Find the circle container for this sender
  let circleEl = isSelf ? elements.localVideoContainer : elements.remoteVideoContainer;
  if (!isSelf && state.primaryPeer !== sender) {
    const extraPane = document.getElementById(`remote-container-${sender}`);
    if (extraPane) circleEl = extraPane;
  }
  
  if (!bubbleEl || !circleEl) return;

  if (!elements.videoPanesWrapper?.classList.contains('layout-circles') && !elements.videoPanesWrapper?.classList.contains('layout-enlarged')) {
    return;
  }

  bubbleEl.textContent = text;
  bubbleEl.classList.remove('hidden');
  
  // Store the active container element ID as a property on the bubbleEl so updateSpeechBubblePositions knows where to align it!
  bubbleEl.dataset.alignedToId = circleEl.id || (isSelf ? 'local-video-container' : 'remote-video-container');

  updateSpeechBubblePositions();

  const paneType = isSelf ? 'local' : 'remote';
  if (speechBubbleTimeouts[paneType]) clearTimeout(speechBubbleTimeouts[paneType]);
  speechBubbleTimeouts[paneType] = setTimeout(() => {
    bubbleEl.classList.add('hidden');
  }, 6000);
}

function updateSpeechBubblePositions() {
  const wrapper = elements.videoPanesWrapper;
  if (!wrapper) return;
  const wrapperRect = wrapper.getBoundingClientRect();

  ['local', 'remote'].forEach(pane => {
    const bubbleEl = pane === 'local' ? elements.localCircleSpeech : elements.remoteCircleSpeech;
    if (!bubbleEl || bubbleEl.classList.contains('hidden')) return;

    let circleEl = pane === 'local' ? elements.localVideoContainer : elements.remoteVideoContainer;
    if (bubbleEl.dataset.alignedToId) {
      const aligned = document.getElementById(bubbleEl.dataset.alignedToId);
      if (aligned) circleEl = aligned;
    }

    if (!circleEl) return;
    const circleRect = circleEl.getBoundingClientRect();
    const centerX = circleRect.left + circleRect.width / 2 - wrapperRect.left;
    const topY = circleRect.top - wrapperRect.top;

    bubbleEl.style.left = `${centerX}px`;
    bubbleEl.style.top = `${topY}px`;
  });
}

async function handleSignalingMessage(data) {
  if (!data || data.sender === state.userName) return;

  // Ignore targeted signaling messages that are not meant for us
  if (data.target && data.target !== state.userName) {
    return;
  }

  if (data.type === 'key-request') {
    handleKeyRequest(data.publicKey, data.sender).then(encKey => {
      if (encKey) relaySend({ type: 'key-response', target: data.sender, sender: state.userName, encryptedKey: encKey });
    });
    return;
  }
  if (data.type === 'key-response') {
    saveReceivedRoomKey(state.roomCode, data.encryptedKey);
    return;
  }

  if (data.type === 'play-together') {
    showToast(`🎮 Partner started a Play Together session! Opening Arcade overlay...`, 'success');
    setTimeout(() => {
      initArcadeUI('guest');
    }, 1500);
    return;
  }

  if (data.type === 'arcade-input') {
    dispatchKeyboardToHost({
      type: data.inputType,
      key: data.key,
      code: data.code,
      keyCode: data.keyCode,
      which: data.which,
      shiftKey: data.shiftKey,
      ctrlKey: data.ctrlKey,
      altKey: data.altKey,
      metaKey: data.metaKey
    });
    return;
  }

  if (data.type === 'arcade-mouse') {
    simulateHostMouseEvent(data.mouseType, data.relX, data.relY, data.button, data.buttons);
    return;
  }

  if (data.type === 'arcade-chat-msg') {
    appendArcadeChatMessage(data.sender, data.text);
    return;
  }

  if (data.type === 'leave-arcade') {
    leaveArcade(false);
    return;
  }

  if (data.type === 'clear-messages') {
    clearRoomMessages(false);
    return;
  } else if (data.type === 'clear-video-messages') {
    clearVideoMessages(false);
    return;
  } else if (data.type === 'toggle-circle-speech') {
    state.circleSpeechEnabled = data.enabled;
    document.body.classList.toggle('circle-speech-on', state.circleSpeechEnabled);
    if (elements.toggleCircleSpeechBtn) {
      elements.toggleCircleSpeechBtn.innerHTML = state.circleSpeechEnabled ? '<span>💭 Circle Speech: On</span>' : '<span>💭 Circle Speech: Off</span>';
      elements.toggleCircleSpeechBtn.classList.toggle('active', state.circleSpeechEnabled);
    }
    if (!state.circleSpeechEnabled) {
      if (elements.remoteCircleSpeech) elements.remoteCircleSpeech.classList.add('hidden');
      if (elements.localCircleSpeech) elements.localCircleSpeech.classList.add('hidden');
    }
    return;
  } else if (data.type === 'screen-share-toggle') {
    state.partnerScreenSharing = data.isScreenSharing;
    if (state.partnerScreenSharing) {
      if (elements.screenShareVideo && elements.remoteVideo) {
        elements.screenShareVideo.srcObject = elements.remoteVideo.srcObject;
        elements.screenShareVideo.play().catch(e => console.debug(e));
      }
      elements.screenShareContainer?.classList.remove('hidden');
    } else {
      if (elements.screenShareVideo) elements.screenShareVideo.srcObject = null;
      elements.screenShareContainer?.classList.add('hidden');
    }
    updateVideoLayout();
    return;
  }

  if (data.type === 'cam-toggle') {
    const peer = data.sender;
    if (peer === state.primaryPeer) {
      if (elements.remoteCamOff) {
        elements.remoteCamOff.classList.toggle('hidden', !data.isCamOff);
        const camOffText = elements.remoteCamOff.querySelector('.cam-off-text');
        if (camOffText) camOffText.textContent = `${peer} Camera Off`;
      }
    } else {
      const extraPane = document.getElementById(`remote-container-${peer}`);
      if (extraPane) {
        const placeholder = extraPane.querySelector('.cam-off-placeholder');
        if (placeholder) placeholder.classList.toggle('hidden', !data.isCamOff);
      }
    }
    return;
  } else if (data.type === 'theme-change') {
    applyTheme(data.theme, data.themeLabel, false);
    return;
  }

  if (data.type === 'call-invite') {
    if (!state.isCalling) {
      showToast(`📹 ${data.sender} is inviting you to a live video call!`, 'info');
      if (elements.inviteSenderText) elements.inviteSenderText.textContent = `${data.sender} is inviting you to a Video Call!`;
      elements.callInviteModal?.classList.remove('hidden');
      triggerRemotePushNotification('📹 Video Call Invitation', `${data.sender} invited you to join a live video stream!`);
    }
    return;
  } else if (data.type === 'call-accept') {
    showToast(`✨ ${data.sender} accepted your invite! Connecting stream...`, 'success');
    if (!state.isCalling) initiateVideoCall();
    return;
  } else if (data.type === 'call-decline') {
    showToast(`⚠️ ${data.sender} declined the video call invitation.`, 'error');
    return;
  }

  if (data.type === 'join-call') {
    if (state.isCalling) {
      showToast(`📹 ${data.sender} is joining the video call room. Connecting...`, 'success');
      const pc = setupPeerConnection(data.sender);
      const offer = await pc.createOffer();
      offer.sdp = boostSdpBitrate(offer.sdp);
      await pc.setLocalDescription(offer);

      sendSignaling({
        type: 'offer',
        target: data.sender,
        sdp: offer,
        sender: state.userName
      });
    }
    return;
  }

  if (data.type === 'offer') {
    if (!state.isCalling) {
      state.pendingOffer = data;
      showToast(`📹 ${data.sender} started a video call!`, 'info');
      if (elements.inviteSenderText) elements.inviteSenderText.textContent = `${data.sender} is inviting you to a Video Call!`;
      elements.callInviteModal?.classList.remove('hidden');
      triggerRemotePushNotification('📹 Video Call Invitation', `${data.sender} invited you to join a live video stream!`);
      return;
    }

    showToast(`📹 Connecting video stream with ${data.sender}...`, 'success');
    const pc = setupPeerConnection(data.sender);

    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    answer.sdp = boostSdpBitrate(answer.sdp);
    await pc.setLocalDescription(answer);

    sendSignaling({
      type: 'answer',
      target: data.sender,
      sdp: answer,
      sender: state.userName
    });

    const pendingCandidates = state.pendingIceCandidates?.[data.sender] || [];
    if (pendingCandidates.length > 0) {
      for (const cand of pendingCandidates) {
        try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
      }
      state.pendingIceCandidates[data.sender] = [];
    }
    return;
  }

  if (data.type === 'answer') {
    const pc = state.peerConnections?.[data.sender];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const pendingCandidates = state.pendingIceCandidates?.[data.sender] || [];
      if (pendingCandidates.length > 0) {
        for (const cand of pendingCandidates) {
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
        }
        state.pendingIceCandidates[data.sender] = [];
      }
    }
    return;
  }

  if (data.type === 'ice-candidate') {
    const pc = state.peerConnections?.[data.sender];
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.warn('ICE add error:', e);
      }
    } else {
      if (!state.pendingIceCandidates) state.pendingIceCandidates = {};
      if (!state.pendingIceCandidates[data.sender]) state.pendingIceCandidates[data.sender] = [];
      state.pendingIceCandidates[data.sender].push(data.candidate);
    }
    return;
  }

  if (data.type === 'end-call') {
    showToast(`${data.sender} left the video call.`, 'info');
    const pc = state.peerConnections?.[data.sender];
    if (pc) {
      try { pc.close(); } catch(e) {}
      delete state.peerConnections[data.sender];
    }
    if (state.remoteStreams?.[data.sender]) {
      delete state.remoteStreams[data.sender];
    }
    if (state.primaryPeer === data.sender) {
      state.primaryPeer = null;
    }
    renderRemoteParticipants();
    return;
  }
}

function endVideoCall() {
  if (!state.isCalling) return;
  sendSignaling({ type: 'end-call', sender: state.userName });
  cleanupMedia();
  clearVideoMessages();
  showToast('You left the call.', 'info');
}

function cleanupMedia() {
  if (state.screenStream) {
    state.screenStream.getTracks().forEach(t => t.stop());
    state.screenStream = null;
  }
  if (state.localStream) {
    state.localStream.getTracks().forEach(t => t.stop());
    state.localStream = null;
  }
  if (state.peerConnection) {
    try { state.peerConnection.close(); } catch(e) {}
    state.peerConnection = null;
  }
  Object.values(state.peerConnections || {}).forEach(pc => {
    try { pc.close(); } catch(e) {}
  });
  state.peerConnections = {};
  state.remoteStreams = {};
  state.primaryPeer = null;
  document.querySelectorAll('.extra-remote-pane').forEach(el => el.remove());

  elements.videoUi?.classList.add('hidden');
  if (elements.localVideo) elements.localVideo.srcObject = null;
  if (elements.remoteVideo) elements.remoteVideo.srcObject = null;
  if (elements.screenShareVideo) elements.screenShareVideo.srcObject = null;
  if (elements.screenShareContainer) elements.screenShareContainer.classList.add('hidden');
  if (elements.remoteCamOff) elements.remoteCamOff.classList.add('hidden');
  if (elements.localCamOff) elements.localCamOff.classList.add('hidden');
  state.isCalling = false;
  state.isScreenSharing = false;
  state.enlargedPane = null;
  state.isMuted = false;
  state.isCamOff = false;
  updateControlEmojis();
  updateVideoLayout();
  if (elements.toggleScreenBtn) elements.toggleScreenBtn.classList.remove('active');
}

async function toggleMute() {
  if (!state.localStream && state.isMuted) return;
  state.isMuted = !state.isMuted;

  if (state.isMuted) {
    if (state.localStream) {
      state.localStream.getAudioTracks().forEach(t => {
        t.enabled = false;
        t.stop();
        state.localStream.removeTrack(t);
      });
    }
  } else {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const newTrack = micStream.getAudioTracks()[0];
      if (state.localStream) {
        state.localStream.addTrack(newTrack);
      } else {
        state.localStream = micStream;
      }
      const pcs = Object.values(state.peerConnections || {});
      if (state.peerConnection && !pcs.includes(state.peerConnection)) pcs.push(state.peerConnection);
      for (const pc of pcs) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(newTrack);
        } else {
          pc.addTrack(newTrack, state.localStream);
        }
      }
    } catch (err) {
      showToast('Could not access microphone', 'error');
      state.isMuted = true;
    }
  }

  updateControlEmojis();
  showToast(state.isMuted ? 'Microphone muted' : 'Microphone unmuted');
}

async function toggleCamera() {
  if (!state.localStream && state.isCamOff) return;
  state.isCamOff = !state.isCamOff;

  if (state.isCamOff) {
    if (state.localStream) {
      state.localStream.getVideoTracks().forEach(t => {
        t.enabled = false;
        t.stop();
        state.localStream.removeTrack(t);
      });
    }
  } else {
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
      const newTrack = camStream.getVideoTracks()[0];
      if (state.localStream) {
        state.localStream.addTrack(newTrack);
      } else {
        state.localStream = camStream;
      }
      if (elements.localVideo) elements.localVideo.srcObject = state.localStream;

      const pcs = Object.values(state.peerConnections || {});
      if (state.peerConnection && !pcs.includes(state.peerConnection)) pcs.push(state.peerConnection);
      for (const pc of pcs) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newTrack);
        } else {
          pc.addTrack(newTrack, state.localStream);
        }
      }
    } catch (err) {
      showToast('Could not access camera', 'error');
      state.isCamOff = true;
    }
  }

  updateControlEmojis();
  if (elements.localCamOff) {
    elements.localCamOff.classList.toggle('hidden', !state.isCamOff);
  }
  sendSignaling({ type: 'cam-toggle', isCamOff: state.isCamOff, sender: state.userName });
  showToast(state.isCamOff ? 'Camera turned off' : 'Camera turned on');
}

function updateControlEmojis() {
  const isPurpleOrYellow = state.activeTheme === 'purple' || state.activeTheme === 'yellow' || state.activeTheme === 'purple-yellow';
  if (elements.toggleMuteBtn) {
    elements.toggleMuteBtn.classList.toggle('active-off', state.isMuted);
    if (isPurpleOrYellow) {
      elements.toggleMuteBtn.textContent = state.isMuted ? '🔇' : '〰️';
    } else {
      elements.toggleMuteBtn.textContent = state.isMuted ? '🔇' : '🎙️';
    }
  }
  if (elements.toggleCamBtn) {
    elements.toggleCamBtn.classList.toggle('active-off', state.isCamOff);
    if (isPurpleOrYellow) {
      elements.toggleCamBtn.textContent = state.isCamOff ? '🚫' : '⚡';
    } else {
      elements.toggleCamBtn.textContent = state.isCamOff ? '🚫' : '📷';
    }
  }
}

/**
 * Enable Web Push Notifications (VAPID)
 */
async function handleEnablePush(silent = false) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (!silent) showToast('Push notifications are not supported in this browser.', 'error');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      if (!silent) showToast('Push notification permission denied.', 'error');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    
    // Demo / Standard VAPID Public Key
    const publicVapidKey = MANUAL_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    state.pushSubscription = subscription;
    console.log('Push subscription acquired:', JSON.stringify(subscription));

    // Save subscription to Supabase 'subscriptions' table
    if (state.supabase && state.roomCode) {
      await state.supabase.from('subscriptions').upsert([{
        room_code: state.roomCode,
        push_sub: JSON.stringify(subscription)
      }]);
    }

    if (!silent) showToast('🔔 Push Notifications enabled for this device!', 'success');
    showNativeNotification('🔔 Push Notifications Active', 'You will now receive notifications when your partner sends pages or calls!');
  } catch (err) {
    console.error('Push setup failed:', err);
    if (!silent) showToast('Could not register push notifications.', 'error');
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function triggerRemotePushNotification(title, body) {
  // Invokes Supabase Edge Function to push notification to partner
  if (!state.supabase || !MANUAL_SUPABASE_URL) return;
  try {
    await state.supabase.functions.invoke('send-push', {
      body: { room_code: state.roomCode, sender: state.userName, title, message: body }
    });
  } catch (err) {
    console.debug('Edge push trigger note:', err?.message);
  }
}

// =========================================================================
// VIDEO CALL INVITATION & PRESENCE
// =========================================================================
function sendCallInvite() {
  sendSignaling({ type: 'call-invite', sender: state.userName });
  showToast('Sent live video invite modal to partner!', 'success');
  triggerRemotePushNotification('📹 Live Video Invite!', `${state.userName} invited you to a live video call! Click to join.`);
  initiateVideoCall();
}

async function acceptCallInvite() {
  elements.callInviteModal?.classList.add('hidden');
  sendSignaling({ type: 'call-accept', sender: state.userName });
  
  if (state.pendingOffer && state.pendingOffer.sdp) {
    const offerData = state.pendingOffer;
    state.pendingOffer = null;
    await answerPendingVideoCall(offerData);
  } else {
    initiateVideoCall();
  }
}

async function answerPendingVideoCall(data) {
  if (state.isCalling) return;
  try {
    await getOrAcquireLocalStream();
    if (elements.localVideo && state.localStream) {
      elements.localVideo.srcObject = state.localStream;
      elements.localVideo.play().catch(e => console.debug('localVideo play note:', e));
    }
    elements.videoUi?.classList.remove('hidden');
    if (elements.remoteWaitingOverlay) elements.remoteWaitingOverlay.style.display = 'flex';
    state.isCalling = true;

    if (!state.peerConnection) setupPeerConnection();

    await state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await state.peerConnection.createAnswer();
    answer.sdp = boostSdpBitrate(answer.sdp);
    await state.peerConnection.setLocalDescription(answer);

    sendSignaling({
      type: 'answer',
      sdp: answer,
      sender: state.userName
    });
    if (state.pendingIceCandidates && state.pendingIceCandidates.length > 0) {
      for (const cand of state.pendingIceCandidates) {
        try { await state.peerConnection.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
      }
      state.pendingIceCandidates = [];
    }
    showToast('Joined live video call! Connecting stream...', 'success');
  } catch (err) {
    showToast('Could not access camera/microphone. Please check browser permissions.', 'error');
    console.error('WebRTC media error:', err);
  }
}

function declineCallInvite() {
  elements.callInviteModal?.classList.add('hidden');
  state.pendingOffer = null;
  sendSignaling({ type: 'call-decline', sender: state.userName });
  showToast('You declined the video call.', 'info');
}

// =========================================================================
// VIDEO CALL LAYOUT CONTROLS (Side-by-Side Default, Click-to-Enlarge, Draggable PiP)
// =========================================================================
function handlePaneClick(paneName) {
  const container = paneName === 'remote' ? elements.remoteVideoContainer : elements.localVideoContainer;
  if (container?.dataset.wasDragged === 'true') {
    delete container.dataset.wasDragged;
    return;
  }

  // Do not reset position or enlarge circles when clicked in screen sharing mode
  if (state.isScreenSharing) return;

  if (state.enlargedPane === paneName) {
    state.enlargedPane = null; // Return to equal side-by-side
    showToast('Screen layout: Side by Side (50/50)');
  } else {
    state.enlargedPane = paneName;
    showToast(`Screen layout: Enlarged ${paneName === 'remote' ? 'Partner' : 'You'}`);
  }
  updateVideoLayout();
}

function updateVideoLayout() {
  const wrapper = elements.videoPanesWrapper;
  if (!wrapper) return;

  const isScreenShareMode = state.isScreenSharing || state.partnerScreenSharing;
  const isCircleMode = isScreenShareMode;

  document.body.classList.toggle('layout-circles-active', isCircleMode);

  wrapper.classList.remove('layout-equal', 'layout-enlarged', 'layout-circles');
  elements.remoteVideoContainer?.classList.remove('enlarged', 'pip', 'circle');
  elements.localVideoContainer?.classList.remove('enlarged', 'pip', 'circle');

  // Toggle pane visibilities inside the unified screenShareContainer
  if (isScreenShareMode) {
    elements.screenShareContainer?.classList.remove('hidden');
    if (elements.screenShareVideo) {
      elements.screenShareVideo.classList.remove('hidden');
    }
  } else {
    elements.screenShareContainer?.classList.add('hidden');
    if (elements.screenShareVideo) elements.screenShareVideo.classList.add('hidden');
  }

  // Reset custom positioning coordinates when returning to default side-by-side
  if (!isCircleMode && !state.enlargedPane) {
    wrapper.classList.add('layout-equal');
    if (elements.remoteVideoContainer) elements.remoteVideoContainer.style.cssText = 'position: relative; flex: 50;';
    if (elements.localVideoContainer) elements.localVideoContainer.style.cssText = 'position: relative; flex: 50;';
    updateSpeechBubblePositions();
    return;
  }

  if (isCircleMode) {
    wrapper.classList.add('layout-circles');
    elements.remoteVideoContainer?.classList.add('circle');
    elements.localVideoContainer?.classList.add('circle');
    // Preserve custom circle position/dimensions if previously dragged or resized
    if (!elements.remoteVideoContainer.style.top && !elements.remoteVideoContainer.style.left) {
      elements.remoteVideoContainer.style.top = '30px';
      elements.remoteVideoContainer.style.left = '30px';
    }
    
    // Position extra remote circles with a cascade offset
    document.querySelectorAll('.extra-remote-pane').forEach((el, index) => {
      el.classList.add('circle');
      if (!el.style.top && !el.style.left) {
        el.style.top = `${30 + (index + 1) * 45}px`;
        el.style.left = `${30 + (index + 1) * 45}px`;
      }
    });

    if (!elements.localVideoContainer.style.bottom && !elements.localVideoContainer.style.right) {
      elements.localVideoContainer.style.bottom = '30px';
      elements.localVideoContainer.style.right = '30px';
    }
  } else if (state.enlargedPane === 'remote') {
    wrapper.classList.add('layout-enlarged');
    elements.remoteVideoContainer?.classList.add('enlarged');
    elements.localVideoContainer?.classList.add('pip');
    if (elements.remoteVideoContainer) elements.remoteVideoContainer.style.cssText = '';
    if (elements.localVideoContainer) elements.localVideoContainer.style.cssText = '';
  } else if (state.enlargedPane === 'local') {
    wrapper.classList.add('layout-enlarged');
    elements.localVideoContainer?.classList.add('enlarged');
    elements.remoteVideoContainer?.classList.add('pip');
    if (elements.remoteVideoContainer) elements.remoteVideoContainer.style.cssText = '';
    if (elements.localVideoContainer) elements.localVideoContainer.style.cssText = '';
  }
  updateSpeechBubblePositions();
}

function setupPaneDragging(paneEl) {
  if (!paneEl) return;
  let isDragging = false;
  let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

  const onStart = (e) => {
    if (e.target?.classList.contains('custom-pane-resizer')) return;
    if (!paneEl.classList.contains('pip') && !paneEl.classList.contains('circle')) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    isDragging = true;
    document.body.classList.add('is-dragging-pane');
    startX = clientX;
    startY = clientY;
    
    initialLeft = paneEl.offsetLeft;
    initialTop = paneEl.offsetTop;
  };

  const onMove = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - startX;
    const dy = clientY - startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      paneEl.dataset.wasDragged = 'true';
    }

    const wrapper = elements.videoPanesWrapper;
    if (!wrapper) return;
    const minLeft = -paneEl.clientWidth + 60;
    const maxLeft = wrapper.clientWidth - 60;
    const minTop = -paneEl.clientHeight + 60;
    const maxTop = wrapper.clientHeight - 60;

    let newLeft = Math.max(minLeft, Math.min(maxLeft, initialLeft + dx));
    let newTop = Math.max(minTop, Math.min(maxTop, initialTop + dy));

    paneEl.style.left = `${newLeft}px`;
    paneEl.style.top = `${newTop}px`;
    paneEl.style.right = 'auto';
    paneEl.style.bottom = 'auto';
    updateSpeechBubblePositions();
  };

  const onEnd = () => {
    isDragging = false;
    document.body.classList.remove('is-dragging-pane');
  };

  paneEl.addEventListener('mousedown', onStart);
  paneEl.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);
}

function setupPaneResizer(paneEl) {
  if (!paneEl) return;
  const resizerBtn = paneEl.querySelector('.custom-pane-resizer');
  if (!resizerBtn) return;

  let isResizing = false;
  let startX = 0, startY = 0, initialW = 0, initialH = 0;

  const onStart = (e) => {
    e.stopPropagation();
    isResizing = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clientX;
    startY = clientY;
    initialW = paneEl.clientWidth;
    initialH = paneEl.clientHeight;

    // Anchor top/left before resizing so expanding width/height goes smoothly towards cursor without jumping
    paneEl.style.left = `${paneEl.offsetLeft}px`;
    paneEl.style.top = `${paneEl.offsetTop}px`;
    paneEl.style.right = 'auto';
    paneEl.style.bottom = 'auto';
  };

  const onMove = (e) => {
    if (!isResizing) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - startX;
    const dy = clientY - startY;

    if (paneEl.classList.contains('circle')) {
      // Keep perfect circle aspect ratio by changing radius uniformly
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      const newSize = Math.max(120, Math.min(650, initialW + delta));
      paneEl.style.width = `${newSize}px`;
      paneEl.style.height = `${newSize}px`;
    } else if (paneEl.classList.contains('pip')) {
      // Change length and width together proportionally when resizing sideways
      const newWidth = Math.max(140, Math.min(800, initialW + dx));
      const ratio = (initialH || 180) / (initialW || 260);
      const newHeight = Math.round(newWidth * ratio);
      paneEl.style.width = `${newWidth}px`;
      paneEl.style.height = `${newHeight}px`;
    }
    updateSpeechBubblePositions();
  };

  const onEnd = () => {
    isResizing = false;
  };

  resizerBtn.addEventListener('mousedown', onStart);
  resizerBtn.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);
}

function setupManualResizer() {
  const resizer = elements.videoResizer;
  const wrapper = elements.videoPanesWrapper;
  const leftPane = elements.remoteVideoContainer;
  const rightPane = elements.localVideoContainer;
  if (!resizer || !wrapper || !leftPane || !rightPane) return;

  let isResizing = false;

  const onStart = (e) => {
    if (!wrapper.classList.contains('layout-equal')) return;
    isResizing = true;
    wrapper.classList.add('resizing-active');
    document.body.style.cursor = 'col-resize';
  };

  const onMove = (e) => {
    if (!isResizing || !wrapper.classList.contains('layout-equal')) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = wrapper.getBoundingClientRect();
    const offset = clientX - rect.left;
    const percent = Math.max(15, Math.min(85, (offset / rect.width) * 100));
    leftPane.style.flex = `${percent}`;
    rightPane.style.flex = `${100 - percent}`;
  };

  const onEnd = () => {
    if (isResizing) {
      isResizing = false;
      wrapper.classList.remove('resizing-active');
      document.body.style.cursor = '';
    }
  };

  resizer.addEventListener('mousedown', onStart);
  resizer.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);
}

function toggleImmersiveFullscreen() {
  state.isImmersiveMode = !state.isImmersiveMode;
  if (state.isImmersiveMode) {
    elements.videoUi?.classList.add('immersive-mode');
    if (elements.toggleChatBgBtn) elements.toggleChatBgBtn.innerHTML = '<span>🖥️ Normal UI</span>';
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    showToast('✨ Immersive Fullscreen Mode. Only videos, floating messages, and input box visible. Hover top-left or press Esc to exit.');
  } else {
    exitImmersiveFullscreen();
  }
}

function exitImmersiveFullscreen() {
  state.isImmersiveMode = false;
  elements.videoUi?.classList.remove('immersive-mode');
  if (elements.toggleChatBgBtn) elements.toggleChatBgBtn.innerHTML = '<span>🖥️ Fullscreen Chat</span>';
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  showToast('Restored standard controls.');
}

function toggleTts() {
  state.ttsEnabled = !state.ttsEnabled;
  if (elements.toggleTtsBtn) {
    elements.toggleTtsBtn.innerHTML = state.ttsEnabled ? '<span>🔊 TTS: On</span>' : '<span>🔊 TTS: Off</span>';
    elements.toggleTtsBtn.classList.toggle('active', state.ttsEnabled);
  }
  if (elements.toggleTtsSidebarBtn) {
    const textSpan = elements.toggleTtsSidebarBtn.querySelector('.btn-text');
    if (textSpan) textSpan.textContent = state.ttsEnabled ? 'Message TTS: On' : 'Message TTS: Off';
    elements.toggleTtsSidebarBtn.classList.toggle('active', state.ttsEnabled);
  }
  showToast(state.ttsEnabled ? '🔊 Message Speech (TTS) enabled for webcall' : '🔇 Message Speech disabled');
}

// =========================================================================
// SCREEN SHARING FUNCTIONALITY (Shows Both Camera & Screen Feed)
// =========================================================================
async function toggleScreenShare() {
  if ((!state.peerConnection && Object.keys(state.peerConnections || {}).length === 0) || !state.localStream) {
    showToast('Join or start a video call before screen sharing.', 'error');
    return;
  }

  if (state.isScreenSharing) {
    if (state.screenStream) {
      state.screenStream.getTracks().forEach(t => t.stop());
      state.screenStream = null;
    }
    const camTrack = state.localStream.getVideoTracks()[0];
    const pcs = Object.values(state.peerConnections || {});
    if (state.peerConnection && !pcs.includes(state.peerConnection)) pcs.push(state.peerConnection);
    for (const pc of pcs) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender && camTrack) {
        await sender.replaceTrack(camTrack).catch(() => {});
      }
    }
    if (elements.localVideo) elements.localVideo.srcObject = state.localStream;
    if (elements.screenShareVideo) elements.screenShareVideo.srcObject = null;
    elements.screenShareContainer?.classList.add('hidden');
    state.isScreenSharing = false;
    if (elements.toggleScreenBtn) {
      elements.toggleScreenBtn.classList.remove('active');
    }
    updateVideoLayout();
    sendSignaling({ type: 'screen-share-toggle', isScreenSharing: false, sender: state.userName });
    showToast('Screen sharing stopped.');
  } else {
    try {
      state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = state.screenStream.getVideoTracks()[0];
      
      screenTrack.onended = () => {
        if (state.isScreenSharing) toggleScreenShare();
      };

      const pcs = Object.values(state.peerConnections || {});
      if (state.peerConnection && !pcs.includes(state.peerConnection)) pcs.push(state.peerConnection);
      for (const pc of pcs) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack).catch(() => {});
        }
      }
      if (elements.screenShareVideo) {
        elements.screenShareVideo.srcObject = state.screenStream;
        elements.screenShareVideo.play().catch(e => console.debug(e));
      }
      elements.screenShareContainer?.classList.remove('hidden');
      state.isScreenSharing = true;
      if (elements.toggleScreenBtn) {
        elements.toggleScreenBtn.classList.add('active');
      }
      updateVideoLayout();
      sendSignaling({ type: 'screen-share-toggle', isScreenSharing: true, sender: state.userName });
      showToast('🖥️ Screen sharing active! Camera feeds converted to resizable floating circles.', 'success');
    } catch (err) {
      console.warn('Screen share canceled or failed:', err);
    }
  }
}

// =========================================================================
// THEMES & MESSAGE CLEARING
// =========================================================================
function getThemeLabel(themeName) {
  if (themeName === 'slate') return '🤎 Warm Slate';
  if (themeName === 'electric-blue') return '⚡ Electric Blue';
  if (themeName === 'pastel-blue') return '🫧 Pastel Blue';
  if (themeName === 'glass') return '🔮 Transparent Glass';
  if (themeName === 'purple') return '💜 Purple';
  if (themeName === 'yellow') return '💛 Yellow';
  if (themeName === 'matcha') return '🍵 Matcha';
  if (themeName === 'strawberry') return '🍓 Strawberry';
  return themeName;
}

function handleThemeSelection(themeName) {
  if (themeName === 'purple-yellow') {
    // 50% chance for whoever pressed it to get purple vs yellow
    const chosenTheme = Math.random() < 0.5 ? 'purple' : 'yellow';
    const partnerTheme = chosenTheme === 'purple' ? 'yellow' : 'purple';
    applyTheme(chosenTheme, chosenTheme === 'purple' ? '💜 Purple' : '💛 Yellow', false);
    sendSignaling({ type: 'theme-change', theme: partnerTheme, themeLabel: partnerTheme === 'purple' ? '💜 Purple' : '💛 Yellow', sender: state.userName });
    showToast(`🎲 50/50 Random Theme: You received the ${chosenTheme.toUpperCase()} theme!`);
  } else if (themeName === 'matcha-strawberry') {
    // 50% chance for whoever pressed it to get matcha vs strawberry
    const chosenTheme = Math.random() < 0.5 ? 'matcha' : 'strawberry';
    const partnerTheme = chosenTheme === 'matcha' ? 'strawberry' : 'matcha';
    applyTheme(chosenTheme, chosenTheme === 'matcha' ? '🍵 Matcha' : '🍓 Strawberry', false);
    sendSignaling({ type: 'theme-change', theme: partnerTheme, themeLabel: partnerTheme === 'matcha' ? '🍵 Matcha' : '🍓 Strawberry', sender: state.userName });
    showToast(`🎲 50/50 Random Theme: You received the ${chosenTheme.toUpperCase()} theme!`);
  } else {
    applyTheme(themeName, getThemeLabel(themeName), true);
  }
}

function applyTheme(themeName, themeLabel, broadcast = true) {
  state.activeTheme = themeName;
  localStorage.setItem('b612_theme', themeName);
  document.body.className = document.body.className.replace(/\btheme-\S+/g, '').trim();
  document.body.classList.add(`theme-${themeName}`);
  if (elements.videoUi) {
    elements.videoUi.className = elements.videoUi.className.replace(/\btheme-\S+/g, '').trim();
    elements.videoUi.classList.add(`theme-${themeName}`);
    if (state.isImmersiveMode) elements.videoUi.classList.add('immersive-mode');
  }
  if (elements.themeColorBtn && themeLabel) {
    elements.themeColorBtn.querySelector('span').textContent = `🎨 Theme: ${themeLabel}`;
  }
  if (elements.roomThemeBtn && themeLabel) {
    elements.roomThemeBtn.title = `Theme: ${themeLabel}`;
  }
  if (elements.frontThemeBtn && themeLabel) {
    elements.frontThemeBtn.title = `Theme: ${themeLabel}`;
  }
  updateControlEmojis();
  showToast(`🎨 Page theme set to ${themeLabel || themeName}!`);
  if (broadcast) {
    sendSignaling({ type: 'theme-change', theme: themeName, themeLabel: themeLabel || themeName, sender: state.userName });
  }
}

async function clearRoomMessages(broadcast = true) {
  if (!elements.chatFeed) return;
  elements.chatFeed.innerHTML = '<div class="empty-feed">Room messages cleared.</div>';
  state.activitiesCount = 0;
  if (elements.feedCount) elements.feedCount.textContent = '0 messages';
  
  if (state.supabase && state.roomCode) {
    try {
      const { error } = await state.supabase.from('messages').delete().eq('room_code', state.roomCode);
      if (error) console.warn('Supabase delete error:', error);
    } catch (e) { console.warn(e); }
  }
  
  showToast('🧹 All room messages deleted!', 'success');
  
  if (broadcast) {
    sendSignaling({ type: 'clear-messages', sender: state.userName });
  }
}

function clearVideoMessages(broadcast = true) {
  if (!elements.videoChatFeed) return;
  elements.videoChatFeed.innerHTML = '';
  showToast('🧹 Video call session messages cleared.');
  if (broadcast) {
    sendSignaling({ type: 'clear-video-messages', sender: state.userName });
  }
}

/* ========================================================== */
/* ARCADE OVERLAY CONTROLLER & SIGNALING SYSTEM (Issue 1 & 2) */
/* ========================================================== */

function setupArcadeDataChannel(channel) {
  if (!channel) return;
  channel.onopen = () => {
    console.log('Arcade keyboard and mouse sync established!');
    showToast('🎮 Game controller channel connected!', 'success');
  };
  channel.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'keydown' || msg.type === 'keyup') {
        dispatchKeyboardToHost(msg);
      } else if (['mousemove', 'mousedown', 'mouseup', 'click', 'mouseleave'].includes(msg.type)) {
        simulateHostMouseEvent(msg.type, msg.relX, msg.relY, msg.button, msg.buttons);
      } else if (msg.type === 'arcade-chat') {
        appendArcadeChatMessage(msg.sender, msg.text);
      }
    } catch (e) {
      console.warn('Error parsing data channel message:', e);
    }
  };
}

function dispatchKeyboardToHost(msg) {
  const player = document.querySelector('#arcade-game ruffle-player');
  if (!player) return;

  console.log('[Host] Simulating guest key:', msg.type, msg.key, msg.code);

  try {
    player.focus();
    const canvas = player.shadowRoot?.querySelector('canvas') || player.querySelector('canvas');
    if (canvas) {
      canvas.focus();
      if (!canvas.hasAttribute('tabindex')) {
        canvas.setAttribute('tabindex', '0');
      }
    }
  } catch (e) {}

  const canvas = player.shadowRoot?.querySelector('canvas') || player.querySelector('canvas');

  const eventInit = {
    key: msg.key || '',
    code: msg.code || '',
    keyCode: msg.keyCode || 0,
    which: msg.which || 0,
    ctrlKey: !!msg.ctrlKey,
    shiftKey: !!msg.shiftKey,
    altKey: !!msg.altKey,
    metaKey: !!msg.metaKey,
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window
  };

  const dispatchTo = (target) => {
    if (!target) return;
    try {
      const e = new KeyboardEvent(msg.type, eventInit);
      
      // Override properties directly on the event instance for strict libraries/WASM
      Object.defineProperty(e, 'key', { get: () => msg.key || '' });
      Object.defineProperty(e, 'code', { get: () => msg.code || '' });
      Object.defineProperty(e, 'keyCode', { get: () => msg.keyCode || 0 });
      Object.defineProperty(e, 'which', { get: () => msg.which || 0 });
      
      e.getModifierState = function(key) {
        if (key === 'Shift') return !!msg.shiftKey;
        if (key === 'Control') return !!msg.ctrlKey;
        if (key === 'Alt') return !!msg.altKey;
        if (key === 'Meta') return !!msg.metaKey;
        return false;
      };

      target.dispatchEvent(e);
    } catch (err) {
      console.warn('Failed dispatch to target:', target, err);
    }
  };

  // Dispatch to the shadow root's canvas (the inner Ruffle rendering target)
  if (canvas) {
    dispatchTo(canvas);
  }

  // Dispatch to player
  dispatchTo(player);

  // Dispatch to document & window
  dispatchTo(document);
  dispatchTo(window);
}

function simulateHostMouseEvent(type, relX, relY, button = 0, buttons = 0) {
  let ghostMouse = document.getElementById('arcade-ghost-mouse');
  if (!ghostMouse) {
    ghostMouse = document.createElement('div');
    ghostMouse.id = 'arcade-ghost-mouse';
    ghostMouse.style.cssText = `
      position: absolute;
      width: 18px;
      height: 18px;
      background: radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(217, 140, 126, 1) 70%);
      border: 2px solid white;
      border-radius: 50%;
      pointer-events: none;
      z-index: 10000;
      display: none;
      box-shadow: 0 4px 10px rgba(0,0,0,0.55);
      transform: translate(-50%, -50%);
      transition: transform 0.05s ease, background 0.1s ease;
    `;
    document.getElementById('arcade-game-container')?.appendChild(ghostMouse);
  }

  if (type === 'mouseleave') {
    ghostMouse.style.display = 'none';
    return;
  }

  const player = document.querySelector('#arcade-game ruffle-player');
  if (!player) return;
  const canvas = player.shadowRoot?.querySelector('canvas') || player.querySelector('canvas') || player;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const absX = rect.left + (relX * rect.width);
  const absY = rect.top + (relY * rect.height);
  const offsetX = relX * rect.width;
  const offsetY = relY * rect.height;

  // Position ghost mouse inside the absolute container
  const container = document.getElementById('arcade-game-container');
  if (container) {
    const containerRect = container.getBoundingClientRect();
    const xInContainer = absX - containerRect.left;
    const yInContainer = absY - containerRect.top;
    
    ghostMouse.style.left = `${xInContainer}px`;
    ghostMouse.style.top = `${yInContainer}px`;
    ghostMouse.style.display = 'block';
  }

  if (type === 'mousedown') {
    ghostMouse.style.transform = 'translate(-50%, -50%) scale(0.85)';
    ghostMouse.style.background = 'radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(239, 68, 68, 1) 70%)';
  } else if (type === 'mouseup') {
    ghostMouse.style.transform = 'translate(-50%, -50%) scale(1)';
    ghostMouse.style.background = 'radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(217, 140, 126, 1) 70%)';
  }

  // Focus on click
  if (type === 'mousedown' || type === 'click') {
    try {
      player.focus();
      canvas.focus();
    } catch (e) {}
  }

  const eventInit = {
    clientX: absX,
    clientY: absY,
    screenX: absX,
    screenY: absY,
    button: button,
    buttons: buttons,
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window
  };

  // Dispatch PointerEvent first (critical for modern Rust/WASM games like Ruffle)
  const pointerType = type.replace('mouse', 'pointer');
  try {
    const pe = new PointerEvent(pointerType, {
      ...eventInit,
      pointerId: 1,
      isPrimary: true,
      width: 1,
      height: 1,
      pressure: buttons > 0 ? 0.5 : 0,
      pointerType: 'mouse'
    });
    Object.defineProperty(pe, 'offsetX', { get: () => offsetX });
    Object.defineProperty(pe, 'offsetY', { get: () => offsetY });
    Object.defineProperty(pe, 'layerX', { get: () => offsetX });
    Object.defineProperty(pe, 'layerY', { get: () => offsetY });
    Object.defineProperty(pe, 'pageX', { get: () => absX + window.scrollX });
    Object.defineProperty(pe, 'pageY', { get: () => absY + window.scrollY });
    
    canvas.dispatchEvent(pe);
  } catch (err) {}

  // Dispatch MouseEvent for standard HTML/JS fallback listeners
  try {
    const me = new MouseEvent(type, eventInit);
    Object.defineProperty(me, 'offsetX', { get: () => offsetX });
    Object.defineProperty(me, 'offsetY', { get: () => offsetY });
    Object.defineProperty(me, 'layerX', { get: () => offsetX });
    Object.defineProperty(me, 'layerY', { get: () => offsetY });
    Object.defineProperty(me, 'pageX', { get: () => absX + window.scrollX });
    Object.defineProperty(me, 'pageY', { get: () => absY + window.scrollY });
    
    canvas.dispatchEvent(me);
  } catch (err) {}
}

function handleArcadeGuestInput(e) {
  // If typing in any input, textarea, or contenteditable, ignore gaming controls
  const activeEl = document.activeElement;
  const tag = activeEl?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || activeEl?.isContentEditable) {
    return;
  }

  // Do not block standard browser shortcuts
  if (e.ctrlKey || e.metaKey || e.key === 'F5' || e.key === 'F11' || e.key === 'F12') {
    return;
  }

  const payload = {
    type: e.type,
    key: e.key,
    code: e.code,
    keyCode: e.keyCode,
    which: e.which,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
    metaKey: e.metaKey
  };
  
  console.log('[Guest] Sending key event:', e.type, e.key, e.code);

  if (state.arcadeDataChannel && state.arcadeDataChannel.readyState === 'open') {
    state.arcadeDataChannel.send(JSON.stringify(payload));
  } else {
    sendSignaling({
      type: 'arcade-input',
      inputType: e.type,
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      which: e.which,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      sender: state.userName
    });
  }

  // Prevent default scroll behaviors inside game mode for typical gaming keys
  const preventKeys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace'];
  if (preventKeys.includes(e.code) || preventKeys.includes(e.key)) {
    e.preventDefault();
  }
}

function sendArcadeMouseEvent(payload) {
  if (state.arcadeDataChannel && state.arcadeDataChannel.readyState === 'open') {
    if (payload.type === 'mousemove') {
      const now = Date.now();
      if (!state.lastMouseDataTime) state.lastMouseDataTime = 0;
      if (now - state.lastMouseDataTime < 10) return; // ~100Hz max rate
      state.lastMouseDataTime = now;
    }
    state.arcadeDataChannel.send(JSON.stringify(payload));
  } else {
    if (payload.type === 'mousemove') {
      const now = Date.now();
      if (!state.lastMouseSignalTime) state.lastMouseSignalTime = 0;
      if (now - state.lastMouseSignalTime < 50) return; // ~20Hz max rate for fallback signaling
      state.lastMouseSignalTime = now;
    }
    sendSignaling({
      type: 'arcade-mouse',
      mouseType: payload.type,
      relX: payload.relX,
      relY: payload.relY,
      button: payload.button,
      buttons: payload.buttons,
      sender: state.userName
    });
  }
}

function handleArcadeGuestMouse(e) {
  const videoEl = document.getElementById('arcade-game-video');
  if (!videoEl) return;

  const rect = videoEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const relX = (e.clientX - rect.left) / rect.width;
  const relY = (e.clientY - rect.top) / rect.height;

  const payload = {
    type: e.type,
    relX: relX,
    relY: relY,
    button: e.button,
    buttons: e.buttons
  };

  if (e.type !== 'mousemove') {
    console.log('[Guest] Sending mouse event:', e.type, 'button:', e.button, 'relX:', relX.toFixed(2), 'relY:', relY.toFixed(2));
  }

  sendArcadeMouseEvent(payload);
}

function handleArcadeGuestMouseLeave() {
  sendArcadeMouseEvent({
    type: 'mouseleave',
    relX: 0,
    relY: 0,
    button: 0,
    buttons: 0
  });
}

function handleArcadeGuestTouch(e) {
  if (!e.touches || e.touches.length === 0) {
    if (e.type === 'touchend') {
      sendArcadeMouseEvent({
        type: 'mouseup',
        relX: state.lastGuestTouchX || 0,
        relY: state.lastGuestTouchY || 0,
        button: 0,
        buttons: 0
      });
    }
    return;
  }
  
  const touch = e.touches[0];
  const videoEl = document.getElementById('arcade-game-video');
  if (!videoEl) return;

  const rect = videoEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const relX = (touch.clientX - rect.left) / rect.width;
  const relY = (touch.clientY - rect.top) / rect.height;
  
  state.lastGuestTouchX = relX;
  state.lastGuestTouchY = relY;

  let mappedType = 'mousemove';
  if (e.type === 'touchstart') mappedType = 'mousedown';
  else if (e.type === 'touchmove') mappedType = 'mousemove';

  sendArcadeMouseEvent({
    type: mappedType,
    relX: relX,
    relY: relY,
    button: 0,
    buttons: 1
  });
}

function appendArcadeChatMessage(sender, text) {
  const isSelf = sender === 'You' || sender === state.userName;
  const displayName = isSelf ? 'You' : sender;
  const msgEl = document.createElement('div');
  msgEl.className = `chat-msg ${isSelf ? 'self' : 'partner'}`;
  msgEl.innerHTML = `
    <div class="chat-msg-meta">${displayName}</div>
    <div>${text}</div>
  `;
  const arcadeChatMessages = document.getElementById('arcade-chat-messages');
  if (arcadeChatMessages) {
    arcadeChatMessages.appendChild(msgEl);
    arcadeChatMessages.scrollTop = arcadeChatMessages.scrollHeight;
  }
}

function initArcadeUI(role) {
  state.inArcade = true;
  state.arcadeRole = role;

  const arcadeOverlay = document.getElementById('arcade-overlay');
  if (arcadeOverlay) {
    arcadeOverlay.style.display = 'flex';
  }
  if (elements.videoUi) {
    elements.videoUi.classList.add('hidden');
  }

  setupBubbleDragging(document.getElementById('arcade-local-bubble'));
  setupBubbleDragging(document.getElementById('arcade-remote-bubble'));

  const arcadeLocalVideo = document.getElementById('arcade-local-video');
  const arcadeRemoteVideo = document.getElementById('arcade-remote-video');

  if (arcadeLocalVideo && state.localStream) {
    arcadeLocalVideo.srcObject = state.localStream;
    arcadeLocalVideo.play().catch(() => {});
  }
  if (arcadeRemoteVideo) {
    const peers = Object.keys(state.remoteStreams || {});
    const webcamStream = peers.length > 0 ? state.remoteStreams[peers[0]] : (elements.remoteVideo?.srcObject);
    if (webcamStream) {
      arcadeRemoteVideo.srcObject = webcamStream;
      arcadeRemoteVideo.play().catch(() => {});
    }
  }

  setupArcadeControls();

  if (role === 'host') {
    initArcadeHost();
  } else {
    initArcadeGuest();
  }
}

async function initArcadeHost() {
  showToast('Initializing Game Emulator...', 'info');

  const ruffle = window.RufflePlayer.newest();
  const player = ruffle.createPlayer();
  const arcadeGameContainer = document.getElementById('arcade-game');
  if (arcadeGameContainer) {
    arcadeGameContainer.innerHTML = '';
    arcadeGameContainer.appendChild(player);
    arcadeGameContainer.classList.remove('hidden');
  }
  
  player.load("https://cdn.jsdelivr.net/gh/StarRepo444/ClassroomPlayV2@c28ef0cfdccbbfc61a42d9954f14af3115c7398a/games/flash/swf/fbwg.swf");

  document.getElementById('arcade-save-game')?.classList.remove('hidden');

  const checkCanvasInterval = setInterval(() => {
    const canvas = player.shadowRoot?.querySelector('canvas');
    if (canvas) {
      clearInterval(checkCanvasInterval);
      showToast('Game loaded! Capturing and broadcasting stream...', 'success');
      
      try {
        const gameStream = canvas.captureStream(60);
        state.arcadeGameStream = gameStream;
        const gameTrack = gameStream.getVideoTracks()[0];
        if (gameTrack && 'contentHint' in gameTrack) {
          gameTrack.contentHint = 'motion';
        }
        
        if (state.peerConnection) {
          if (state.arcadeGameSender) {
            try { state.peerConnection.removeTrack(state.arcadeGameSender); } catch(e){}
          }
          state.arcadeGameSender = state.peerConnection.addTrack(gameTrack, gameStream);
          
          // Maximize sender parameters for high FPS and high bitrate
          try {
            const parameters = state.arcadeGameSender.getParameters();
            if (!parameters.encodings) {
              parameters.encodings = [{}];
            }
            parameters.encodings.forEach(encoding => {
              encoding.maxBitrate = 8000000; // 8 Mbps
              encoding.maxFramerate = 60; // 60 FPS
              encoding.priority = 'high';
              encoding.networkPriority = 'high';
            });
            state.arcadeGameSender.setParameters(parameters).catch(e => console.warn(e));
          } catch (e) {
            console.warn('Could not set sender parameters:', e);
          }
          
          // Renegotiate
          state.peerConnection.createOffer().then(offer => {
            offer.sdp = boostSdpBitrate(offer.sdp);
            return state.peerConnection.setLocalDescription(offer).then(() => {
              sendSignaling({
                type: 'offer',
                sdp: offer,
                sender: state.userName
              });
            });
          }).catch(err => {
            console.error('Failed to renegotiate for game stream:', err);
          });
        }
      } catch (streamErr) {
        console.error('Failed to capture ruffle canvas stream:', streamErr);
      }
    }
  }, 1000);
}

function initArcadeGuest() {
  showToast('Connected to Host Arcade!', 'success');
  const arcadeGameVideo = document.getElementById('arcade-game-video');
  if (arcadeGameVideo) {
    arcadeGameVideo.classList.remove('hidden');
    
    if (state.arcadeRemoteStream) {
      arcadeGameVideo.srcObject = state.arcadeRemoteStream;
      arcadeGameVideo.play().catch(err => console.warn('Guest video play failed:', err));
    } else if (elements.remoteVideo && elements.remoteVideo.srcObject) {
      arcadeGameVideo.srcObject = elements.remoteVideo.srcObject;
      arcadeGameVideo.play().catch(err => console.warn('Guest video play failed:', err));
    }

    // Register guest mouse and touch events for canvas simulation
    arcadeGameVideo.addEventListener('mousemove', handleArcadeGuestMouse);
    arcadeGameVideo.addEventListener('mousedown', handleArcadeGuestMouse);
    arcadeGameVideo.addEventListener('mouseup', handleArcadeGuestMouse);
    arcadeGameVideo.addEventListener('click', handleArcadeGuestMouse);
    arcadeGameVideo.addEventListener('mouseleave', handleArcadeGuestMouseLeave);

    // Touch support for mobile controls
    arcadeGameVideo.addEventListener('touchstart', handleArcadeGuestTouch, { passive: true });
    arcadeGameVideo.addEventListener('touchmove', handleArcadeGuestTouch, { passive: true });
    arcadeGameVideo.addEventListener('touchend', handleArcadeGuestTouch, { passive: true });
  }

  document.getElementById('arcade-guest-guide-panel')?.classList.remove('hidden');

  document.addEventListener('keydown', handleArcadeGuestInput);
  document.addEventListener('keyup', handleArcadeGuestInput);
}

function setupArcadeControls() {
  const toggleSideBtn = document.getElementById('arcade-toggle-side-btn');
  const controlBar = document.getElementById('arcade-control-bar');
  
  toggleSideBtn?.addEventListener('click', () => {
    if (controlBar) {
      if (controlBar.classList.contains('side-right')) {
        controlBar.classList.remove('side-right');
        controlBar.classList.add('side-left');
      } else {
        controlBar.classList.remove('side-left');
        controlBar.classList.add('side-right');
      }
    }
  });

  const toggleMic = document.getElementById('arcade-toggle-mic');
  toggleMic?.addEventListener('click', () => {
    if (state.localStream) {
      state.isMuted = !state.isMuted;
      state.localStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
      toggleMic.classList.toggle('active-off', state.isMuted);
      showToast(state.isMuted ? 'Microphone Muted' : 'Microphone Active');
      updateControlEmojis();
    }
  });

  const toggleCamera = document.getElementById('arcade-toggle-camera');
  toggleCamera?.addEventListener('click', () => {
    if (state.localStream) {
      state.isCamOff = !state.isCamOff;
      state.localStream.getVideoTracks().forEach(t => t.enabled = !state.isCamOff);
      const localVid = document.getElementById('arcade-local-video');
      if (localVid) localVid.style.opacity = state.isCamOff ? '0' : '1';
      toggleCamera.classList.toggle('active-off', state.isCamOff);
      showToast(state.isCamOff ? 'Webcam Paused' : 'Webcam Restored');
      updateControlEmojis();
    }
  });

  const toggleChat = document.getElementById('arcade-toggle-chat');
  const chatOverlay = document.getElementById('arcade-chat-overlay');
  toggleChat?.addEventListener('click', () => {
    if (chatOverlay) {
      chatOverlay.classList.toggle('hidden');
      if (!chatOverlay.classList.contains('hidden')) {
        document.getElementById('arcade-chat-input')?.focus();
      }
    }
  });

  document.getElementById('arcade-close-chat')?.addEventListener('click', () => {
    chatOverlay?.classList.add('hidden');
  });

  const saveGame = document.getElementById('arcade-save-game');
  saveGame?.addEventListener('click', () => {
    try {
      const backup = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('ruffle') || key.includes('VirtualFS')) {
          backup[key] = localStorage.getItem(key);
        }
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
      const dlAnchor = document.createElement('a');
      dlAnchor.setAttribute("href", dataStr);
      dlAnchor.setAttribute("download", `b612_ruffle_arcade_backup_${Date.now()}.json`);
      document.body.appendChild(dlAnchor);
      dlAnchor.click();
      dlAnchor.remove();
      showToast('Manual save LSO backup triggered!', 'success');
    } catch (e) {
      showToast('Auto-save active! Progress stored in IndexedDB.', 'success');
    }
  });

  document.getElementById('arcade-leave-arcade')?.addEventListener('click', () => {
    leaveArcade(true);
  });

  const chatForm = document.getElementById('arcade-chat-form');
  const chatInput = document.getElementById('arcade-chat-input');
  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (chatInput) {
      const text = chatInput.value.trim();
      if (text) {
        appendArcadeChatMessage('You', text);
        
        if (state.arcadeDataChannel && state.arcadeDataChannel.readyState === 'open') {
          state.arcadeDataChannel.send(JSON.stringify({
            type: 'arcade-chat',
            sender: state.userName,
            text: text
          }));
        } else {
          sendSignaling({
            type: 'arcade-chat-msg',
            sender: state.userName,
            text: text
          });
        }
        chatInput.value = '';
      }
    }
  });
}

async function leaveArcade(broadcast = true) {
  if (!state.inArcade) return;
  state.inArcade = false;

  if (state.arcadeGameStream) {
    state.arcadeGameStream.getTracks().forEach(t => t.stop());
    state.arcadeGameStream = null;
  }

  const ghostMouse = document.getElementById('arcade-ghost-mouse');
  if (ghostMouse) {
    ghostMouse.style.display = 'none';
  }

  if (state.arcadeRole === 'host') {
    if (state.arcadeGameSender && state.peerConnection) {
      try {
        state.peerConnection.removeTrack(state.arcadeGameSender);
      } catch (e) {}
      state.arcadeGameSender = null;
      
      // Renegotiate to clean up the peer connection
      try {
        const offer = await state.peerConnection.createOffer();
        await state.peerConnection.setLocalDescription(offer);
        sendSignaling({
          type: 'offer',
          sdp: offer,
          sender: state.userName
        });
      } catch (e) {
        console.error('Failed to renegotiate on leaving arcade:', e);
      }
    }
  } else {
    // Clear the guest's remote arcade stream
    state.arcadeRemoteStream = null;

    // Deregister guest mouse events
    const arcadeGameVideo = document.getElementById('arcade-game-video');
    if (arcadeGameVideo) {
      arcadeGameVideo.removeEventListener('mousemove', handleArcadeGuestMouse);
      arcadeGameVideo.removeEventListener('mousedown', handleArcadeGuestMouse);
      arcadeGameVideo.removeEventListener('mouseup', handleArcadeGuestMouse);
      arcadeGameVideo.removeEventListener('click', handleArcadeGuestMouse);
      arcadeGameVideo.removeEventListener('mouseleave', handleArcadeGuestMouseLeave);
      arcadeGameVideo.removeEventListener('touchstart', handleArcadeGuestTouch);
      arcadeGameVideo.removeEventListener('touchmove', handleArcadeGuestTouch);
      arcadeGameVideo.removeEventListener('touchend', handleArcadeGuestTouch);
    }
  }

  document.removeEventListener('keydown', handleArcadeGuestInput);
  document.removeEventListener('keyup', handleArcadeGuestInput);

  const arcadeOverlay = document.getElementById('arcade-overlay');
  if (arcadeOverlay) {
    arcadeOverlay.style.display = 'none';
  }
  if (elements.videoUi) {
    elements.videoUi.classList.remove('hidden');
  }

  updateVideoLayout();

  if (broadcast) {
    sendSignaling({ type: 'leave-arcade', sender: state.userName });
  }
  
  showToast('Left the Arcade. Webcam video call restored!');
}

function setupBubbleDragging(el) {
  if (!el) return;
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  el.addEventListener('mousedown', dragMouseDown);
  el.addEventListener('touchstart', dragTouchStart, { passive: false });

  function dragMouseDown(e) {
    if (e.target.closest('button') || e.target.closest('input')) return;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.addEventListener('mouseup', closeDragElement);
    document.addEventListener('mousemove', elementDrag);
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    let newTop = el.offsetTop - pos2;
    let newLeft = el.offsetLeft - pos1;
    
    const maxTop = window.innerHeight - el.offsetHeight;
    const maxLeft = window.innerWidth - el.offsetWidth;
    
    el.style.top = `${Math.max(0, Math.min(newTop, maxTop))}px`;
    el.style.left = `${Math.max(0, Math.min(newLeft, maxLeft))}px`;
    el.style.bottom = 'auto';
    el.style.right = 'auto';
  }

  function closeDragElement() {
    document.removeEventListener('mouseup', closeDragElement);
    document.removeEventListener('mousemove', elementDrag);
  }

  function dragTouchStart(e) {
    if (e.target.closest('button') || e.target.closest('input')) return;
    const touch = e.touches[0];
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    document.addEventListener('touchend', closeTouchDragElement);
    document.addEventListener('touchmove', elementTouchDrag, { passive: false });
  }

  function elementTouchDrag(e) {
    e.preventDefault();
    const touch = e.touches[0];
    pos1 = pos3 - touch.clientX;
    pos2 = pos4 - touch.clientY;
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    
    let newTop = el.offsetTop - pos2;
    let newLeft = el.offsetLeft - pos1;
    
    const maxTop = window.innerHeight - el.offsetHeight;
    const maxLeft = window.innerWidth - el.offsetWidth;
    
    el.style.top = `${Math.max(0, Math.min(newTop, maxTop))}px`;
    el.style.left = `${Math.max(0, Math.min(newLeft, maxLeft))}px`;
    el.style.bottom = 'auto';
    el.style.right = 'auto';
  }

  function closeTouchDragElement() {
    document.removeEventListener('touchend', closeTouchDragElement);
    document.removeEventListener('touchmove', elementTouchDrag);
  }
}


window.fetchMediaBlob = async (fileId, originalType) => {
   if (!state.supabase) return null;
   try {
       const { data, error } = await state.supabase
           .from('messages')
           .select('content')
           .eq('room_code', state.roomCode)
           .eq('type', 'media-chunk')
           .like('content', `%${fileId}%`);
       
       if (error || !data) return null;
       
       const chunks = [];
       for (const row of data) {
           try {
               const cleanContent = row.content.replace(/^.*?: /, '');
               const parsed = JSON.parse(cleanContent);
               if (parsed.fileId === fileId) {
                   chunks.push(parsed);
               }
           } catch(e) {}
       }
       chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
       
       let base64Data = '';
       for (const c of chunks) {
           base64Data += c.data;
       }
       
       const binaryStr = atob(base64Data);
       const bytes = new Uint8Array(binaryStr.length);
       for (let i = 0; i < binaryStr.length; i++) {
           bytes[i] = binaryStr.charCodeAt(i);
       }
       return new Blob([bytes], { type: 'application/octet-stream' });
   } catch(e) {
       console.error('fetchMediaBlob error:', e);
       return null;
   }
};

window.downloadEncryptedMedia = async (fileId, type, name) => {
   try {
       showToast('Fetching and decrypting download...', 'info');
       const blob = await fetchMediaBlob(fileId, type);
       if (!blob) throw new Error('Blob not found');
       const decryptedBlob = await decryptFile(blob, type);
       const objUrl = URL.createObjectURL(decryptedBlob);
       const a = document.createElement('a');
       a.href = objUrl;
       a.download = name;
       a.click();
       URL.revokeObjectURL(objUrl);
   } catch(e) {
       showToast('Decryption failed', 'error');
   }
};
