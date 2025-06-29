
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VoiceRecorder from '@/components/VoiceRecorder';
import VoiceUpload from '@/components/VoiceUpload';
import IdeaForm from '@/components/IdeaForm';
import SubmissionStatus from '@/components/SubmissionStatus';

const Index = () => {
  const [currentStep, setCurrentStep] = useState<'record' | 'form' | 'status'>('record');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);

  const handleRecordingComplete = (data: any) => {
    setFormData(data);
    setSessionId(data.session_id);
    setCurrentStep('form');
  };

  const handleSubmissionComplete = () => {
    setCurrentStep('status');
  };

  const resetForm = () => {
    setCurrentStep('record');
    setSessionId(null);
    setFormData(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="container mx-auto px-4 pt-8 pb-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
            Smart Idea Submission
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform your ideas into structured submissions using our AI-powered voice assistant. 
            Record your thoughts or upload an audio file, and we'll help you create a complete proposal.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
              currentStep === 'record' ? 'bg-purple-600 border-purple-600 text-white' : 
              currentStep === 'form' || currentStep === 'status' ? 'bg-green-500 border-green-500 text-white' :
              'border-gray-300 text-gray-400'
            }`}>
              1
            </div>
            <div className={`h-1 w-16 transition-all duration-300 ${
              currentStep === 'form' || currentStep === 'status' ? 'bg-purple-600' : 'bg-gray-300'
            }`} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
              currentStep === 'form' ? 'bg-purple-600 border-purple-600 text-white' : 
              currentStep === 'status' ? 'bg-green-500 border-green-500 text-white' :
              'border-gray-300 text-gray-400'
            }`}>
              2
            </div>
            <div className={`h-1 w-16 transition-all duration-300 ${
              currentStep === 'status' ? 'bg-purple-600' : 'bg-gray-300'
            }`} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
              currentStep === 'status' ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 text-gray-400'
            }`}>
              3
            </div>
          </div>
        </div>

        {/* Step Labels */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center justify-between w-80 text-sm text-gray-600">
            <span className={currentStep === 'record' ? 'font-semibold text-purple-600' : ''}>
              Share Your Idea
            </span>
            <span className={currentStep === 'form' ? 'font-semibold text-purple-600' : ''}>
              Review & Complete
            </span>
            <span className={currentStep === 'status' ? 'font-semibold text-purple-600' : ''}>
              Submission Status
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {currentStep === 'record' && (
            <Tabs defaultValue="record" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="record">Record Voice</TabsTrigger>
                <TabsTrigger value="upload">Upload Audio</TabsTrigger>
              </TabsList>
              
              <TabsContent value="record" className="mt-0">
                <VoiceRecorder onComplete={handleRecordingComplete} />
              </TabsContent>
              
              <TabsContent value="upload" className="mt-0">
                <VoiceUpload onComplete={handleRecordingComplete} />
              </TabsContent>
            </Tabs>
          )}
          
          {currentStep === 'form' && sessionId && (
            <IdeaForm 
              sessionId={sessionId}
              initialData={formData}
              onComplete={handleSubmissionComplete}
            />
          )}
          
          {currentStep === 'status' && sessionId && (
            <SubmissionStatus 
              sessionId={sessionId}
              onReset={resetForm}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
