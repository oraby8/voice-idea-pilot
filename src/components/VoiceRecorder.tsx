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
  const [showMissingFields, setShowMissingFields] = useState(false);
  const [missingFieldsData, setMissingFieldsData] = useState<any>(null);
  const [additionalInput, setAdditionalInput] = useState('');
  
  // Missing fields voice recording states
  const [isMissingFieldsRecording, setIsMissingFieldsRecording] = useState(false);
  const [missingFieldsRecordingTime, setMissingFieldsRecordingTime] = useState(0);
  const [missingFieldsAudioBlob, setMissingFieldsAudioBlob] = useState<Blob | null>(null);
  const [useMissingFieldsText, setUseMissingFieldsText] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const missingFieldsMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const missingFieldsTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startMissingFieldsRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      missingFieldsMediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setMissingFieldsAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsMissingFieldsRecording(true);
      setMissingFieldsRecordingTime(0);
      
      missingFieldsTimerRef.current = setInterval(() => {
        setMissingFieldsRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone for missing fields:', error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please use text input instead.",
        variant: "destructive"
      });
    }
  };

  const stopMissingFieldsRecording = () => {
    if (missingFieldsMediaRecorderRef.current && isMissingFieldsRecording) {
      missingFieldsMediaRecorderRef.current.stop();
      setIsMissingFieldsRecording(false);
      if (missingFieldsTimerRef.current) {
        clearInterval(missingFieldsTimerRef.current);
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
        formData.append('audio', audioBlob);
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
      
      // Check status from backend response
      if (data.status === 'complete') {
        // Map complete data to expected format and proceed
        const mappedData = {
          session_id: data.session_id,
          extracted_fields: data.form_data,
          missing_fields: [],
          status: data.status,
          message: data.message || 'Processing complete'
        };
        
        toast({
          title: "Processing Complete",
          description: "Your idea has been analyzed. Please review the extracted information.",
        });
        
        onComplete(mappedData);
        
      } else if (data.status === 'incomplete') {
        // Handle incomplete status - ask user for missing fields
        setMissingFieldsData(data);
        setShowMissingFields(true);
        
        toast({
          title: "Additional Information Needed",
          description: `Please provide information for ${data.missing_fields.length} missing fields.`,
          variant: "default"
        });
      } else {
        // Handle other statuses
        console.error('Unexpected status:', data.status);
        toast({
          title: "Unexpected Response",
          description: "Received unexpected status from backend.",
          variant: "destructive"
        });
      }
      
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

  const submitAdditionalInfo = async () => {
    if (!missingFieldsAudioBlob && !additionalInput.trim()) {
      toast({
        title: "No Input",
        description: "Please provide additional information via voice or text.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      
      if (missingFieldsAudioBlob && !useMissingFieldsText) {
        formData.append('audio', missingFieldsAudioBlob);
      } else {
        formData.append('text', additionalInput);
      }
      formData.append('session_id', missingFieldsData.session_id);
      
      console.log('Submitting additional info to backend:', useMissingFieldsText ? 'text' : 'audio');
      
      const response = await fetch('http://localhost:3000/start_submission', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Additional info response:', data);
      
      if (data.status === 'complete') {
        // Now complete, proceed to form
        const mappedData = {
          session_id: data.session_id,
          extracted_fields: data.form_data,
          missing_fields: [],
          status: data.status,
          message: data.message || 'Processing complete'
        };
        
        toast({
          title: "Processing Complete",
          description: "Your idea has been fully analyzed.",
        });
        
        onComplete(mappedData);
        
      } else if (data.status === 'incomplete') {
        // Still incomplete, update missing fields
        setMissingFieldsData(data);
        setAdditionalInput('');
        setMissingFieldsAudioBlob(null);
        
        toast({
          title: "More Information Needed",
          description: `Still missing information for ${data.missing_fields.length} fields.`,
        });
      }
      
    } catch (error) {
      console.error('Error submitting additional info:', error);
      toast({
        title: "Submission Error",
        description: "Could not submit additional information.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
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
          {!showMissingFields ? (
            <>
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
            </>
          ) : (
            /* Missing Fields Interface */
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-amber-800 mb-2">
                  📝 Additional Information Needed
                </h3>
                <p className="text-gray-600">
                  Please provide more details about the following missing fields:
                </p>
              </div>

              {missingFieldsData?.missing_fields && (
                <div className="bg-amber-50 p-4 rounded-lg">
                  <div className="font-medium text-amber-800 mb-2">Missing Fields:</div>
                  <ul className="list-disc list-inside text-amber-700 space-y-1">
                    {missingFieldsData.missing_fields.map((field: string) => (
                      <li key={field} className="capitalize">
                        {field.replace('_', ' ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {missingFieldsData?.message && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="font-medium text-blue-800 mb-1">System Message:</div>
                  <p className="text-blue-700">{missingFieldsData.message}</p>
                </div>
              )}

              {/* Method Toggle for Missing Fields */}
              <div className="flex justify-center space-x-4">
                <Button
                  variant={!useMissingFieldsText ? "default" : "outline"}
                  onClick={() => setUseMissingFieldsText(false)}
                  className={!useMissingFieldsText ? "bg-amber-600 hover:bg-amber-700" : ""}
                >
                  🎤 Voice Response
                </Button>
                <Button
                  variant={useMissingFieldsText ? "default" : "outline"}
                  onClick={() => setUseMissingFieldsText(true)}
                  className={useMissingFieldsText ? "bg-amber-600 hover:bg-amber-700" : ""}
                >
                  ✏️ Text Response
                </Button>
              </div>

              {/* Voice Recording Interface for Missing Fields */}
              {!useMissingFieldsText && (
                <div className="text-center space-y-4">
                  <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isMissingFieldsRecording 
                      ? 'bg-red-500 animate-pulse shadow-lg shadow-red-200' 
                      : 'bg-gradient-to-br from-amber-500 to-orange-600 hover:shadow-lg hover:shadow-amber-200 cursor-pointer'
                  }`}>
                    <div className="text-white text-2xl">
                      {isMissingFieldsRecording ? '⏹️' : '🎤'}
                    </div>
                  </div>
                  
                  {isMissingFieldsRecording && (
                    <div className="text-center">
                      <div className="text-lg font-mono text-red-600 mb-2">
                        {formatTime(missingFieldsRecordingTime)}
                      </div>
                      <div className="text-sm text-gray-600">Recording response...</div>
                    </div>
                  )}
                  
                  {missingFieldsAudioBlob && !isMissingFieldsRecording && (
                    <div className="text-center">
                      <div className="text-green-600 mb-2">✅ Response recorded</div>
                      <div className="text-sm text-gray-600">Ready to submit</div>
                    </div>
                  )}
                  
                  <div className="flex justify-center space-x-4">
                    {!isMissingFieldsRecording ? (
                      <Button
                        onClick={startMissingFieldsRecording}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        Start Recording
                      </Button>
                    ) : (
                      <Button
                        onClick={stopMissingFieldsRecording}
                        variant="destructive"
                      >
                        Stop Recording
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Text Input Interface for Missing Fields */}
              {useMissingFieldsText && (
                <div className="space-y-4">
                  <Textarea
                    placeholder="Please provide the missing information. You can address multiple fields in your response..."
                    value={additionalInput}
                    onChange={(e) => setAdditionalInput(e.target.value)}
                    className="min-h-32 text-base"
                  />
                </div>
              )}
              
              <div className="flex justify-center space-x-4">
                <Button
                  onClick={() => {
                    setShowMissingFields(false);
                    setMissingFieldsData(null);
                    setAdditionalInput('');
                    setMissingFieldsAudioBlob(null);
                  }}
                  variant="outline"
                >
                  Start Over
                </Button>
                <Button
                  onClick={submitAdditionalInfo}
                  disabled={(!additionalInput.trim() && !missingFieldsAudioBlob) || isProcessing}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Processing...
                    </>
                  ) : (
                    'Submit Additional Info'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceRecorder;
