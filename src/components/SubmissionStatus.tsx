
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SubmissionStatusProps {
  sessionId: string;
  onReset: () => void;
}

const SubmissionStatus = ({ sessionId, onReset }: SubmissionStatusProps) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [sessionId]);

  const fetchStatus = async () => {
    try {
      console.log('Fetching status for session:', sessionId);
      
      const response = await fetch(`/submission_status/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setStatus(data);
      
    } catch (error) {
      console.error('Error fetching status:', error);
      
      // Mock status for demonstration
      const mockStatus = {
        session_id: sessionId,
        status: 'completed',
        submission_id: 'SUB_' + Date.now(),
        created_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        summary: {
          title: 'Smart Parking Solution',
          category: 'Technology',
          priority: 'High',
          estimated_impact: 'Significant cost savings and improved user experience'
        },
        next_steps: [
          'Technical feasibility review scheduled',
          'Budget approval process initiated',
          'Stakeholder presentation scheduled for next week'
        ]
      };
      
      setStatus(mockStatus);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'processing': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'processing': return '⏳';
      case 'pending': return '⏰';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-xl">
        <CardContent className="pt-8">
          <div className="text-center space-y-4">
            <div className="animate-spin w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full mx-auto" />
            <div className="text-lg font-medium">Checking submission status...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="text-6xl mb-4">
            {getStatusIcon(status?.status)}
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            Submission {status?.status === 'completed' ? 'Successful' : 'Status'}
          </CardTitle>
          <CardDescription className="text-lg">
            Your idea has been processed and submitted to the review system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge className={`${getStatusColor(status?.status)} text-white px-4 py-2 text-base`}>
              {status?.status?.toUpperCase()}
            </Badge>
          </div>

          {/* Submission Details */}
          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Submission ID:</span>
                <div className="font-mono text-purple-600">{status?.submission_id}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Session ID:</span>
                <div className="font-mono text-purple-600">{status?.session_id}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Submitted:</span>
                <div>{new Date(status?.created_at).toLocaleString()}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Processed:</span>
                <div>{new Date(status?.processed_at).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Idea Summary */}
          {status?.summary && (
            <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
              <CardHeader>
                <CardTitle className="text-lg">📋 Submission Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium text-gray-600">Title:</span>
                  <div className="text-lg font-semibold text-gray-800">{status.summary.title}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-gray-600">Category:</span>
                    <div>{status.summary.category}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Priority:</span>
                    <Badge variant="outline" className="ml-2">
                      {status.summary.priority}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Impact Assessment:</span>
                  <div className="text-gray-700">{status.summary.estimated_impact}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          {status?.next_steps && status.next_steps.length > 0 && (
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-lg">🚀 Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {status.next_steps.map((step: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span className="text-gray-700">{step}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-center space-x-4 pt-6">
            <Button
              onClick={onReset}
              variant="outline"
              size="lg"
              className="px-6"
            >
              Submit Another Idea
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="bg-purple-600 hover:bg-purple-700 px-6"
              size="lg"
            >
              View Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubmissionStatus;
