const socket = io();
let localStream, peerConnection;
let currentUser = "";

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

socket.on('connected', (data) => {
  console.log('Connected to server:', data.message);
});

function register() {
  currentUser = document.getElementById("username").value;
  socket.emit('register', { username: currentUser });
  alert("Registered as " + currentUser);
}

async function startCall() {
  const target = document.getElementById("targetUser").value;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('localVideo').srcObject = localStream;

  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        to: target,
        candidate: event.candidate
      });
    }
  };

  peerConnection.ontrack = event => {
    document.getElementById('remoteVideo').srcObject = event.streams[0];
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('call', {
    from: currentUser,
    to: target,
    offer: offer
  });
}

socket.on('incoming_call', async data => {
  const fromUser = data.from;
  const offer = data.offer;

  const accept = confirm(`${fromUser} is calling you. Accept call?`);

  if (!accept) {
    console.log("Call declined");
    return;
  }

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('localVideo').srcObject = localStream;

  peerConnection = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        to: fromUser,
        candidate: event.candidate
      });
    }
  };

  peerConnection.ontrack = event => {
    document.getElementById('remoteVideo').srcObject = event.streams[0];
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('answer', {
    to: fromUser,
    answer: answer
  });
});

socket.on('answer', async data => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
});

socket.on('ice-candidate', async data => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});
