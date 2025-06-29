import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

interface VoiceRecorderProps {
  onComplete: (data: any) => void;
}

const VoiceRecorder = ({ onComplete }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [useText, setUseText] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please try text input instead.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const submitRecording = async () => {
    if (!audioBlob && !textInput.trim()) {
      toast({
        title: "No Input",
        description: "Please record audio or enter text to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      
      if (audioBlob && !useText) {
        formData.append('audio', audioBlob, 'recording.webm');
      } else {
        formData.append('text', textInput);
      }
      
      console.log('Submitting to Python backend on port 3000:', useText ? 'text' : 'audio');
      
      const response = await fetch('http://localhost:3000/start_submission', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received response from backend:', data);
      
      toast({
        title: "Processing Complete",
        description: "Your idea has been analyzed. Please review the extracted information.",
      });
      
      onComplete(data);
      
    } catch (error) {
      console.error('Error connecting to Python backend:', error);
      
      toast({
        title: "Backend Connection Error",
        description: "Could not connect to Python backend on port 3000. Please ensure your backend is running.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-800">
            Share Your Idea
          </CardTitle>
          <CardDescription className="text-lg">
            Choose your preferred method to describe your innovative idea
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Method Toggle */}
          <div className="flex justify-center space-x-4">
            <Button
              variant={!useText ? "default" : "outline"}
              onClick={() => setUseText(false)}
              className={!useText ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              🎤 Voice Recording
            </Button>
            <Button
              variant={useText ? "default" : "outline"}
              onClick={() => setUseText(true)}
              className={useText ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              ✏️ Text Input
            </Button>
          </div>

          {/* Voice Recording Interface */}
          {!useText && (
            <div className="text-center space-y-6">
              <div className={`mx-auto w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                isRecording 
                  ? 'bg-red-500 animate-pulse shadow-lg shadow-red-200' 
                  : 'bg-gradient-to-br from-purple-500 to-blue-600 hover:shadow-lg hover:shadow-purple-200 cursor-pointer'
              }`}>
                <div className="text-white text-4xl">
                  {isRecording ? '⏹️' : '🎤'}
                </div>
              </div>
              
              {isRecording && (
                <div className="text-center">
                  <div className="text-xl font-mono text-red-600 mb-2">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="text-sm text-gray-600">Recording in progress...</div>
                </div>
              )}
              
              {audioBlob && !isRecording && (
                <div className="text-center">
                  <div className="text-green-600 mb-2">✅ Recording completed</div>
                  <div className="text-sm text-gray-600">Ready to process your idea</div>
                </div>
              )}
              
              <div className="flex justify-center space-x-4">
                {!isRecording ? (
                  <Button
                    onClick={startRecording}
                    size="lg"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Start Recording
                  </Button>
                ) : (
                  <Button
                    onClick={stopRecording}
                    size="lg"
                    variant="destructive"
                  >
                    Stop Recording
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Text Input Interface */}
          {useText && (
            <div className="space-y-4">
              <Textarea
                placeholder="Describe your idea in detail... Include information about what problem it solves, how it works, expected impact, timeline, and any other relevant details."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="min-h-32 text-base"
              />
              <div className="text-sm text-gray-500">
                💡 Tip: The more details you provide, the better our AI can structure your submission
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={submitRecording}
              disabled={(!audioBlob && !textInput.trim()) || isProcessing}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 px-8"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Processing...
                </>
              ) : (
                'Process My Idea 🚀'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceRecorder;
