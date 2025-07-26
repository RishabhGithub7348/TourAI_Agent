'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Globe, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Language {
  name: string
  code: string
  flag: string
}

const SUPPORTED_LANGUAGES: Language[] = [
  { name: 'English (US)', code: 'en-US', flag: '🇺🇸' },
  { name: 'English (UK)', code: 'en-GB', flag: '🇬🇧' },
  { name: 'English (Australia)', code: 'en-AU', flag: '🇦🇺' },
  { name: 'English (India)', code: 'en-IN', flag: '🇮🇳' },
  { name: 'Spanish (Spain)', code: 'es-ES', flag: '🇪🇸' },
  { name: 'Spanish (US)', code: 'es-US', flag: '🇺🇸' },
  { name: 'French (France)', code: 'fr-FR', flag: '🇫🇷' },
  { name: 'French (Canada)', code: 'fr-CA', flag: '🇨🇦' },
  { name: 'German (Germany)', code: 'de-DE', flag: '🇩🇪' },
  { name: 'Italian (Italy)', code: 'it-IT', flag: '🇮🇹' },
  { name: 'Portuguese (Brazil)', code: 'pt-BR', flag: '🇧🇷' },
  { name: 'Japanese (Japan)', code: 'ja-JP', flag: '🇯🇵' },
  { name: 'Korean (South Korea)', code: 'ko-KR', flag: '🇰🇷' },
  { name: 'Mandarin Chinese (China)', code: 'cmn-CN', flag: '🇨🇳' },
  { name: 'Hindi (India)', code: 'hi-IN', flag: '🇮🇳' },
  { name: 'Arabic (Generic)', code: 'ar-XA', flag: '🌐' },
  { name: 'Russian (Russia)', code: 'ru-RU', flag: '🇷🇺' },
  { name: 'Vietnamese (Vietnam)', code: 'vi-VN', flag: '🇻🇳' },
  { name: 'Thai (Thailand)', code: 'th-TH', flag: '🇹🇭' },
  { name: 'Turkish (Turkey)', code: 'tr-TR', flag: '🇹🇷' },
  { name: 'Dutch (Netherlands)', code: 'nl-NL', flag: '🇳🇱' },
  { name: 'Polish (Poland)', code: 'pl-PL', flag: '🇵🇱' },
  { name: 'Indonesian (Indonesia)', code: 'id-ID', flag: '🇮🇩' },
  { name: 'Bengali (India)', code: 'bn-IN', flag: '🇮🇳' },
  { name: 'Gujarati (India)', code: 'gu-IN', flag: '🇮🇳' },
  { name: 'Kannada (India)', code: 'kn-IN', flag: '🇮🇳' },
  { name: 'Malayalam (India)', code: 'ml-IN', flag: '🇮🇳' },
  { name: 'Marathi (India)', code: 'mr-IN', flag: '🇮🇳' },
  { name: 'Tamil (India)', code: 'ta-IN', flag: '🇮🇳' },
  { name: 'Telugu (India)', code: 'te-IN', flag: '🇮🇳' },
]

interface LanguageSelectorProps {
  selectedLanguage: string
  onLanguageChange: (languageCode: string) => void
}

export function LanguageSelector({ selectedLanguage, onLanguageChange }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedLang = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage) || SUPPORTED_LANGUAGES[0]

  const handleLanguageSelect = (languageCode: string) => {
    onLanguageChange(languageCode)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        title={`Language: ${selectedLang.name}`}
        className="h-10 px-3 rounded-full hover:bg-white/10 transition-all duration-300 text-white/60 hover:text-white flex items-center space-x-2"
      >
        <Globe className="w-4 h-4" />
        <span className="text-lg">{selectedLang.flag}</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-12 z-50 w-64 max-h-80 overflow-y-auto bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg shadow-2xl"
            >
              <div className="p-3">
                <div className="text-white text-sm font-medium mb-2 px-3 py-2">
                  Select Language
                </div>
                
                <div className="space-y-1">
                  {SUPPORTED_LANGUAGES.map((language) => (
                    <button
                      key={language.code}
                      onClick={() => handleLanguageSelect(language.code)}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors
                        ${selectedLanguage === language.code 
                          ? 'bg-blue-600/20 text-blue-400' 
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{language.flag}</span>
                        <span>{language.name}</span>
                      </div>
                      {selectedLanguage === language.code && (
                        <Check className="w-4 h-4 text-blue-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}