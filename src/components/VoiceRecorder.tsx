import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, Trash2, Loader2 } from "lucide-react";

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onRemove: () => void;
  audioUrl?: string | null;
}

export function VoiceRecorder({ onRecordingComplete, onRemove, audioUrl }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(!!audioUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(audioUrl || null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioSrc && audioSrc.startsWith("blob:")) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType 
        });
        const url = URL.createObjectURL(audioBlob);
        setAudioSrc(url);
        setHasRecording(true);
        onRecordingComplete(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioSrc) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const removeRecording = () => {
    if (audioSrc && audioSrc.startsWith("blob:")) {
      URL.revokeObjectURL(audioSrc);
    }
    setAudioSrc(null);
    setHasRecording(false);
    setRecordingTime(0);
    onRemove();
  };

  return (
    <div className="space-y-4">
      {/* Audio element for playback */}
      {audioSrc && (
        <audio 
          ref={audioRef} 
          src={audioSrc} 
          onEnded={handleAudioEnded}
          className="hidden"
        />
      )}

      {/* Recording Controls */}
      {!hasRecording && !isRecording && (
        <button
          type="button"
          onClick={startRecording}
          className="w-full flex items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/30 transition-all duration-200 group"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Mic className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-medium text-foreground">Record Voice Note</p>
            <p className="text-sm text-muted-foreground">Click to start recording</p>
          </div>
        </button>
      )}

      {/* Recording in Progress */}
      {isRecording && (
        <div className="flex items-center justify-between p-6 rounded-xl bg-destructive/5 border border-destructive/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
              <div className="w-3 h-3 rounded-full bg-destructive" />
            </div>
            <div>
              <p className="font-medium text-foreground">Recording...</p>
              <p className="text-2xl font-mono text-destructive">{formatTime(recordingTime)}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={stopRecording}
            className="gap-2"
          >
            <Square className="w-4 h-4" />
            Stop
          </Button>
        </div>
      )}

      {/* Recording Complete */}
      {hasRecording && !isRecording && (
        <div className="flex items-center justify-between p-6 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={togglePlayback}
              className="w-12 h-12 rounded-full"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>
            <div>
              <p className="font-medium text-foreground">Voice Note Recorded</p>
              <p className="text-sm text-muted-foreground">
                {recordingTime > 0 ? formatTime(recordingTime) : "Ready to save"}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={removeRecording}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
