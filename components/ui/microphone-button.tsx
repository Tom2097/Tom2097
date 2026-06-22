"use client"

import { Button } from '@/components/ui/button'
import { Mic, MicOff } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'

interface MicrophoneButtonProps {
  onTranscript: (transcript: string) => void
  className?: string
}

export function MicrophoneButton({ onTranscript, className }: MicrophoneButtonProps) {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const onTranscriptRef = useRef(onTranscript)

  onTranscriptRef.current = onTranscript

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

      if (!SpeechRecognition) {
        setError('Speech recognition is not supported in your browser.')
        return
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        onTranscriptRef.current(transcript)
        setIsListening(false)
      }

      recognition.onerror = (event) => {
        setError(event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      setError(null)
      try {
        recognitionRef.current?.start()
        setIsListening(true)
      } catch {
        setError('Failed to start microphone')
      }
    }
  }, [isListening])

  return (
    <div className={className}>
      <Button
        variant="outline"
        size="icon"
        onClick={toggleListening}
        disabled={!!error}
        aria-label={isListening ? "Stop listening" : "Start listening"}
      >
        {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}