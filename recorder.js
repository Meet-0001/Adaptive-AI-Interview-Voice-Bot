/**
 * recorder.js — MediaRecorder wrapper for voice input
 */

class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.stream = null;
    this.isRecording = false;
    this.onResult = null;  // callback(text)
    this.onError = null;   // callback(err)
    this.onStart = null;
    this.onStop = null;
  }

  async start() {
    if (this.isRecording) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];

      const mimeType = this._getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.chunks, { type: mimeType });
        await this._sendToServer(blob, mimeType);
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      if (this.onStart) this.onStart();

    } catch (err) {
      if (this.onError) this.onError('Microphone access denied or not available.');
    }
  }

  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;
    this.mediaRecorder?.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    if (this.onStop) this.onStop();
  }

  toggle() {
    if (this.isRecording) {
      this.stop();
    } else {
      this.start();
    }
  }

  async _sendToServer(blob, mimeType) {
    try {
      const ext = mimeType.includes('ogg') ? '.ogg' : mimeType.includes('mp4') ? '.mp4' : '.webm';
      const formData = new FormData();
      formData.append('audio', blob, `recording${ext}`);

      const resp = await fetch('/api/stt', {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) throw new Error('STT request failed');

      const data = await resp.json();
      if (this.onResult) this.onResult(data.text || '');
    } catch (err) {
      if (this.onError) this.onError('Could not transcribe audio: ' + err.message);
    }
  }

  _getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  }
}

window.VoiceRecorder = VoiceRecorder;