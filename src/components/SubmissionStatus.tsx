import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';


// Config - can be moved to a separate config file
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://fastmt.tarjama.com/voice-backend';


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
      console.log('Fetching status from Python backend for session:', sessionId);
      
      const response = await fetch(`${BACKEND_URL}/submission_status/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setStatus(data);
      
    } catch (error) {
      console.error('Error connecting to Python backend for status:', error);
      
      // Show connection error in UI
      setStatus({
        session_id: sessionId,
        status: 'connection_error',
        error: 'Could not connect to Python backend on port 3000'
      });
    } finally {
      setLoading(false);
    }
  };

  const exportAsCSV = () => {
    if (!status?.form_data) return;

    const headers = Object.keys(status.form_data).filter(key => status.form_data[key]);
    const values = headers.map(key => status.form_data[key]);

    // Create CSV content
    const csvContent = [
      headers.map(header => `"${header.replace(/_/g, ' ').toUpperCase()}"`).join(','),
      values.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `idea_submission_${sessionId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Map backend status to display status
  const getDisplayStatus = (backendStatus: string): 'completed' | 'processing' | 'connection_error' | 'pending' | 'failed' => {
    switch (backendStatus) {
      case 'complete': return 'completed';
      case 'needs_clarification': return 'processing';
      case 'connection_error': return 'connection_error';
      case 'failed': return 'failed';
      default: return 'pending';
    }
  };

  const getStatusColor = (status: string) => {
    const displayStatus = getDisplayStatus(status);
    switch (displayStatus) {
      case 'completed': return 'bg-green-500';
      case 'processing': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      case 'connection_error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    const displayStatus = getDisplayStatus(status);
    switch (displayStatus) {
      case 'completed': return '✅';
      case 'processing': return '⏳';
      case 'pending': return '⏰';
      case 'failed': return '❌';
      case 'connection_error': return '🔌';
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

  const displayStatus = getDisplayStatus(status?.status);

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-xl">
        <CardHeader className="text-center">
          <div className="text-6xl mb-4">
            {getStatusIcon(status?.status)}
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            {status?.status === 'connection_error' ? 'Connection Error' : 
             displayStatus === 'completed' ? 'Submission Complete' : 'Submission Status'}
          </CardTitle>
          <CardDescription className="text-lg">
            {status?.status === 'connection_error' 
              ? 'Could not connect to Python backend on port 3000'
              : displayStatus === 'completed'
              ? 'Your idea has been successfully processed'
              : 'Your idea is being processed'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge
              className={`
                ${getStatusColor(status?.status)}
                text-white px-4 py-2 text-base
                ${getDisplayStatus(status?.status) === 'completed' ? 'hover:bg-green-500' : ''}
              `}
            >
              {status?.status === 'connection_error' ? 'CONNECTION ERROR' : displayStatus.toUpperCase()}
            </Badge>
          </div>

          {/* Error Message */}
          {status?.status === 'connection_error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-red-800 font-medium">Backend Connection Failed</div>
              <div className="text-red-600 text-sm mt-1">
                Please ensure your Python backend is running on port 3000
              </div>
            </div>
          )}

          {/* Session Details */}
          {status?.status !== 'connection_error' && (
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Session ID:</span>
                  <div className="font-mono text-purple-600">{status?.session_id}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Status:</span>
                  <div className="capitalize">{status?.status?.replace(/_/g, ' ')}</div>
                </div>
              </div>
            </div>
          )}

          {/* Form Data Display */}
          {status?.form_data && (
            <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">📋 Extracted Information</CardTitle>
                <Button
                  onClick={exportAsCSV}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={displayStatus !== 'completed'}
                >
                  <Download size={16} />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(status.form_data).map(([key, value]) => (
                  value ? (
                    <div key={key}>
                      <span className="font-medium text-gray-600 capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <div className="text-gray-800">{String(value)}</div>
                    </div>
                  ) : null
                ))}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubmissionStatus;
