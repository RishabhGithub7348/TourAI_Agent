'use client'

import { useState, useRef, useCallback } from 'react'
import { AudioUtils } from '@/utils/audioUtils'

export const useAudioRecording = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia(
        AudioUtils.getMediaConstraints()
      )
      console.log('Microphone access granted:', stream.getAudioTracks()[0]?.getSettings())

      streamRef.current = stream
      
      // Choose the best available format
      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4'
        }
      }
      console.log('Using MIME type:', mimeType)
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Audio chunk received:', event.data.size, 'bytes')
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
      }

      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
      console.log('Recording started')

      // Audio level monitoring
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      
      const updateAudioLevel = () => {
        if (isRecording) {
          analyser.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel(average / 255)
          requestAnimationFrame(updateAudioLevel)
        }
      }
      updateAudioLevel()

      return true
    } catch (error) {
      console.error('Error starting recording:', error)
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          console.error('Microphone access denied by user')
        } else if (error.name === 'NotFoundError') {
          console.error('No microphone found')
        }
      }
      return false
    }
  }, [isRecording])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      console.log('Stopping recording...')
      
      if (!mediaRecorderRef.current || !isRecording) {
        console.log('No active recording to stop')
        resolve(null)
        return
      }

      mediaRecorderRef.current.onstop = () => {
        console.log('Recording stopped, creating blob from', audioChunksRef.current.length, 'chunks')
        
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
        })
        
        console.log('Audio blob created:', {
          size: audioBlob.size,
          type: audioBlob.type
        })
        
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            console.log('Stopping track:', track.kind, track.label)
            track.stop()
          })
        }
        
        setIsRecording(false)
        setAudioLevel(0)
        resolve(audioBlob)
      }

      mediaRecorderRef.current.stop()
    })
  }, [isRecording])

  const getPCMData = useCallback(async (audioBlob: Blob): Promise<string> => {
    return await AudioUtils.convertToPCM(audioBlob);
  }, []);

  return {
    isRecording,
    audioLevel,
    startRecording,
    stopRecording,
    getPCMData
  }
}

export const useAudioPlayback = () => {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const playAudio = useCallback(async (audioData: string | Blob): Promise<boolean> => {
    try {
      setIsPlaying(true);

      if (typeof audioData === 'string') {
        // Base64 encoded audio from Gemini Live API
        await AudioUtils.playBase64Audio(audioData);
      } else {
        // Blob audio
        const audioUrl = URL.createObjectURL(audioData);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
      }
      
      return true;
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      return false;
    }
  }, [])

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }, [])

  return {
    isPlaying,
    playAudio,
    stopAudio
  }
}