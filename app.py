from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
socketio = SocketIO(app)

users = {}

@app.route('/')
def index():
    return render_template('index.html')

# ✅ Tambahan: deteksi saat client connect
@socketio.on('connect')
def handle_connect():
    print(f'✅ Client connected: {request.sid}')
    emit('connected', {'message': 'You are connected to the server!'})

@socketio.on('disconnect')
def handle_disconnect():
    print(f'❌ Client disconnected: {request.sid}')
    # hapus user dari list jika perlu
    disconnected_user = None
    for username, sid in users.items():
        if sid == request.sid:
            disconnected_user = username
            break
    if disconnected_user:
        del users[disconnected_user]
        print(f'Removed user: {disconnected_user}')

# Register user
@socketio.on('register')
def handle_register(data):
    username = data['username']
    users[username] = request.sid
    print(f'👤 Registered user: {username}')

# Call request
@socketio.on('call')
def handle_call(data):
    from_user = data['from']
    to_user = data['to']
    offer = data['offer']
    print(f'{from_user} is calling {to_user}')
    if to_user in users:
        emit('incoming_call', {'from': from_user, 'offer': offer}, room=users[to_user])




@socketio.on('answer')
def handle_answer(data):
    to_user = data['to']
    answer = data['answer']
    emit('answer', {'answer': answer}, room=users[to_user])

@socketio.on('ice-candidate')
def handle_ice_candidate(data):
    to_user = data['to']
    candidate = data['candidate']
    emit('ice-candidate', {'candidate': candidate}, room=users[to_user])

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)


