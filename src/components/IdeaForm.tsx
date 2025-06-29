
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

interface IdeaFormProps {
  sessionId: string;
  initialData: any;
  onComplete: () => void;
}

const IdeaForm = ({ sessionId, initialData, onComplete }: IdeaFormProps) => {
  const [formData, setFormData] = useState(initialData?.extracted_fields || {});
  const [missingFields, setMissingFields] = useState(initialData?.missing_fields || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clarificationNeeded, setClarificationNeeded] = useState(false);
  const [currentMessage, setCurrentMessage] = useState(initialData?.message || '');
  const [clarificationResponse, setClarificationResponse] = useState('');

  useEffect(() => {
    if (missingFields.length > 0 || currentMessage) {
      setClarificationNeeded(true);
    }
  }, [missingFields, currentMessage]);

  const handleClarificationSubmit = async () => {
    if (!clarificationResponse.trim()) {
      toast({
        title: "Response Required",
        description: "Please provide a response to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('Submitting clarification to Python backend:', {
        session_id: sessionId,
        response: clarificationResponse
      });

      const response = await fetch('http://localhost:3000/provide_clarification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          response: clarificationResponse
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Clarification response:', data);
      
      // Update form with new information from backend
      setFormData(data.form_data);
      setMissingFields(data.missing_fields || []);
      setCurrentMessage(data.message || '');
      setClarificationResponse('');
      
      if (data.status === 'complete') {
        setClarificationNeeded(false);
        toast({
          title: "Information Complete",
          description: "All required fields have been filled. You can now review and submit.",
        });
      }

    } catch (error) {
      console.error('Error connecting to Python backend for clarification:', error);
      
      toast({
        title: "Backend Connection Error",
        description: "Could not connect to Python backend on port 3000. Please ensure your backend is running.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      console.log('Final submission:', { sessionId, formData });
      
      toast({
        title: "Submission Successful",
        description: "Your idea has been submitted successfully!",
      });
      
      setTimeout(() => onComplete(), 1500);
      
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Submission Error",
        description: "There was an error submitting your idea. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* AI Extracted Information */}
      <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
            🤖 AI-Extracted Information
          </CardTitle>
          <CardDescription>
            Review and edit the information our AI extracted from your input
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Idea Title</Label>
              <Input
                id="title"
                value={formData.title || ''}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder="Enter your idea title"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category || ''}
                onChange={(e) => handleFieldChange('category', e.target.value)}
                placeholder="e.g., Technology, Process Improvement"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Detailed description of your idea"
              className="min-h-24"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expected_impact">Expected Impact</Label>
              <Textarea
                id="expected_impact"
                value={formData.expected_impact || ''}
                onChange={(e) => handleFieldChange('expected_impact', e.target.value)}
                placeholder="What impact do you expect?"
                className="min-h-16"
              />
            </div>
            <div>
              <Label htmlFor="implementation_timeline">Implementation Timeline</Label>
              <Input
                id="implementation_timeline"
                value={formData.implementation_timeline || ''}
                onChange={(e) => handleFieldChange('implementation_timeline', e.target.value)}
                placeholder="e.g., 3-6 months"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="required_resources">Required Resources</Label>
            <Textarea
              id="required_resources"
              value={formData.required_resources || ''}
              onChange={(e) => handleFieldChange('required_resources', e.target.value)}
              placeholder="What resources will be needed?"
              className="min-h-16"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clarification Section */}
      {clarificationNeeded && currentMessage && (
        <Card className="backdrop-blur-sm bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-amber-800 flex items-center">
              💬 Additional Information Needed
            </CardTitle>
            <CardDescription className="text-amber-700">
              Please provide the following information to complete your submission
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/50 p-4 rounded-lg">
              <Label className="text-base font-medium text-gray-700">
                {currentMessage}
              </Label>
              <Textarea
                value={clarificationResponse}
                onChange={(e) => setClarificationResponse(e.target.value)}
                placeholder="Type your response here..."
                className="mt-2 min-h-20"
              />
            </div>
            
            <div className="flex justify-end">
              <Button
                onClick={handleClarificationSubmit}
                disabled={isSubmitting || !clarificationResponse.trim()}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Processing...
                  </>
                ) : (
                  'Submit Response'
                )}
              </Button>
            </div>
            
            {missingFields.length > 0 && (
              <div className="text-sm text-amber-700 bg-amber-100 p-2 rounded">
                📝 Missing fields: {missingFields.join(', ')}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Final Submission */}
      {!clarificationNeeded && (
        <Card className="backdrop-blur-sm bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-xl">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-green-600 text-lg font-semibold">
                ✅ Your idea submission is ready!
              </div>
              <p className="text-gray-600">
                All required information has been collected. Review your submission above and click submit when ready.
              </p>
              <Button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                size="lg"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 px-8"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit My Idea 🚀'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IdeaForm;
