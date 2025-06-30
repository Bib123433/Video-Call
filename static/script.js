const socket = io();
let localStream, peerConnection;
let currentUser = "";
let incomingCallData = null;
let remoteDescSet = false;
let queuedCandidates = [];
let cameraOn = true;
let micOn = true;

const config = {
  iceServers: [
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "739d178dfb590a9426f6cc65",
      credential: "DlrblmLJ4XFOqLnh",
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "739d178dfb590a9426f6cc65",
      credential: "DlrblmLJ4XFOqLnh",
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "739d178dfb590a9426f6cc65",
      credential: "DlrblmLJ4XFOqLnh",
    },
  ]
};

socket.on('connected', (data) => {
  console.log('✅ Connected to server:', data.message);
});

function register() {
  currentUser = document.getElementById("username").value;
  socket.emit('register', { username: currentUser });
  alert("Registered as " + currentUser);
}

async function setupPeer(toUser) {
  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        to: toUser,
        candidate: event.candidate
      });
    }
  };

  peerConnection.ontrack = event => {
    console.log("📽️ Remote stream received");
    const remoteVideo = document.getElementById("remoteVideo");
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.muted = true; // ⬅️ Tambahkan ini di sini

    document.getElementById("callingStatus").classList.add("d-none");
    document.getElementById("callControls").classList.remove("d-none");
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log("ICE State:", peerConnection.iceConnectionState);
  };
  peerConnection.onconnectionstatechange = () => {
    console.log("Peer Connection State:", peerConnection.connectionState);
  };
}

async function startCall() {
  const target = document.getElementById("targetUser").value;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('localVideo').srcObject = localStream;

  await setupPeer(target);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('call', {
    from: currentUser,
    to: target,
    offer: offer
  });

  document.getElementById('defaultUI').style.display = 'none';
  let callModal = new bootstrap.Modal(document.getElementById('callScreen'));
  callModal.show();

  document.getElementById("remoteVideo").muted = true;

  document.getElementById('remoteVideo').classList.add('d-none');
  document.getElementById('callControls').classList.remove('d-none');
  document.getElementById('callingStatus').classList.remove('d-none');

  showControlsTemporarily();
}

socket.on('incoming_call', async data => {
  incomingCallData = { fromUser: data.from, offer: data.offer };
  document.getElementById('callOverlay').style.display = 'flex';
  document.getElementById("incomingCallBox").style.display = 'block';
  document.getElementById('callerNameIncoming').innerText = `${data.from} menelpon Anda`;
});

async function acceptIncoming() {
  const { fromUser, offer } = incomingCallData;

  document.getElementById("callOverlay").style.display = 'none';

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('localVideo').srcObject = localStream;

  await setupPeer(fromUser);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  remoteDescSet = true;

  for (let candidate of queuedCandidates) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
  queuedCandidates = [];

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('answer', {
    to: fromUser,
    answer: answer
  });

  let callModal = new bootstrap.Modal(document.getElementById('callScreen'));
  callModal.show();

  document.getElementById('defaultUI').style.display = 'none';
  document.getElementById('callerNameStatus').classList.add('d-none');

  document.getElementById('callControls').classList.remove('d-none'); // tampilkan tombol kontrol
  showControlsTemporarily(); // mulai timer untuk sembunyi otomatis
}

function declineIncoming() {
  document.getElementById('callOverlay').style.display = 'none';
  document.getElementById('incomingCallBox').style.display = 'none';
  incomingCallData = null;
}

function endCall() {
  document.getElementById('defaultUI').style.display = 'block';

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  remoteDescSet = false;
  queuedCandidates = [];

  let callModal = bootstrap.Modal.getInstance(document.getElementById('callScreen'));
  if (callModal) callModal.hide();
}

socket.on('answer', async data => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  remoteDescSet = true;

  for (let candidate of queuedCandidates) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
  queuedCandidates = [];

  document.getElementById('callingStatus').classList.add('d-none');
  document.getElementById('remoteVideo').classList.remove('d-none');
  document.getElementById('callControls').classList.remove('d-none');

  showControlsTemporarily();
});

socket.on('ice-candidate', async data => {
  if (!remoteDescSet) {
    queuedCandidates.push(data.candidate);
  } else if (peerConnection) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (err) {
      console.error("❌ Failed to add ICE candidate:", err);
    }
  }
});


function stopCamera() {
  const localVideo = document.getElementById('localVideo');
  const cameraBtnIcon = document.querySelector('#cameraToggleBtn'); // pastikan id-nya benar

  if (!cameraBtnIcon) {
    console.log('❌ Kamera icon tidak ditemukan');
    return;
  }

  const videoTrack = localStream?.getVideoTracks()[0];

  if (videoTrack) {
    if (cameraOn) {
      videoTrack.enabled = false;
      cameraBtnIcon.classList.remove('fa-video-slash');
      cameraBtnIcon.classList.add('fa-video');
      cameraOn = false;
      console.log("📷 Kamera dimatikan");
    } else {
      videoTrack.enabled = true;
      cameraBtnIcon.classList.remove('fa-video');
      cameraBtnIcon.classList.add('fa-video-slash');
      cameraOn = true;
      console.log("📷 Kamera dinyalakan");
    }
  } else {
    console.log("🚫 Tidak ada video track di stream");
  }
}

function Muted() {
  const audioBtnIcon = document.querySelector('#audioToggleBtn');
  const audioTrack = localStream?.getAudioTracks()[0];

  if (!audioBtnIcon) {
    console.log('❌ Ikon mic tidak ditemukan');
    return;
  }

  if (audioTrack) {
    if (micOn) {
      audioTrack.enabled = false;
      audioBtnIcon.classList.remove('fa-microphone-slash');
      audioBtnIcon.classList.add('fa-microphone');
      micOn = false;
      console.log('🔇 Mikrofon dimatikan');
    } else {
      audioTrack.enabled = true;
      audioBtnIcon.classList.remove('fa-microphone');
      audioBtnIcon.classList.add('fa-microphone-slash');
      micOn = true;
      console.log('🎤 Mikrofon dinyalakan');
    }

    const sender = peerConnection.getSenders().find(s => s.track?.kind === 'audio');
    if (sender) {
      sender.replaceTrack(audioTrack);
    }

  } else {
    console.log("🚫 Tidak ada audio track");
  }
}





// === Auto Hide Control Buttons like Zoom ===
let controlTimeout;

function showControlsTemporarily() {
  const controls = document.getElementById('callControls');
  controls.classList.remove('d-none');

  if (controlTimeout) clearTimeout(controlTimeout);

  controlTimeout = setTimeout(() => {
    controls.classList.add('d-none');
  }, 3000);
}

document.getElementById('callScreen').addEventListener('mousemove', showControlsTemporarily);
