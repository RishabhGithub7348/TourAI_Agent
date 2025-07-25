'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Book, Play, Pause, SkipForward, MapPin, Clock } from 'lucide-react'

interface Story {
  id: string
  title: string
  description: string
  duration: string
  location: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
}

const sampleStories: Story[] = [
  {
    id: '1',
    title: 'Ancient Rome Walking Tour',
    description: 'Discover the secrets of the Colosseum and Roman Forum through immersive storytelling',
    duration: '45 min',
    location: 'Rome, Italy',
    difficulty: 'easy',
    tags: ['History', 'Architecture', 'Ancient']
  },
  {
    id: '2',
    title: 'Mystery of the Louvre',
    description: 'Uncover hidden stories behind famous artworks and mysterious disappearances',
    duration: '60 min',
    location: 'Paris, France',
    difficulty: 'medium',
    tags: ['Art', 'Mystery', 'Culture']
  },
  {
    id: '3',
    title: 'Secrets of Old London',
    description: 'Follow the footsteps of Jack the Ripper and Victorian-era mysteries',
    duration: '90 min',
    location: 'London, UK',
    difficulty: 'hard',
    tags: ['Mystery', 'Victorian', 'Crime']
  }
]

interface StoryModeProps {
  onStartStory: (storyId: string) => void
  isOpen: boolean
  onClose: () => void
}

export function StoryMode({ onStartStory, isOpen, onClose }: StoryModeProps) {
  const [selectedStory, setSelectedStory] = useState<string | null>(null)

  const getDifficultyColor = (difficulty: Story['difficulty']) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-400/20'
      case 'medium': return 'text-yellow-400 bg-yellow-400/20'
      case 'hard': return 'text-red-400 bg-red-400/20'
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Book className="w-8 h-8 text-blue-400" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Story Mode</h2>
                  <p className="text-gray-400">Immersive audio adventures</p>
                </div>
              </div>
              <Button variant="ghost" onClick={onClose}>
                ✕
              </Button>
            </div>

            {/* Stories Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sampleStories.map((story) => (
                <motion.div
                  key={story.id}
                  whileHover={{ scale: 1.02 }}
                  className={`glass rounded-xl p-4 cursor-pointer border transition-all duration-200 ${
                    selectedStory === story.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-white/20 hover:border-blue-400/50'
                  }`}
                  onClick={() => setSelectedStory(story.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(story.difficulty)}`}>
                      {story.difficulty}
                    </div>
                    <div className="flex items-center text-gray-400 text-sm">
                      <Clock className="w-4 h-4 mr-1" />
                      {story.duration}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">{story.title}</h3>
                  <p className="text-gray-300 text-sm mb-3 line-clamp-2">{story.description}</p>

                  <div className="flex items-center text-gray-400 text-sm mb-3">
                    <MapPin className="w-4 h-4 mr-1" />
                    {story.location}
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {story.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-white/10 text-gray-300 text-xs rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {selectedStory === story.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="border-t border-white/20 pt-3"
                    >
                      <Button
                        variant="gradient"
                        className="w-full"
                        onClick={() => onStartStory(story.id)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start Adventure
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Story Player (if story is selected and playing) */}
            {selectedStory && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 glass rounded-xl p-4 border border-blue-500/30"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">Now Playing</h4>
                    <p className="text-gray-400 text-sm">
                      {sampleStories.find(s => s.id === selectedStory)?.title}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="icon">
                      <Pause className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="w-full bg-white/20 rounded-full h-1">
                    <div className="bg-blue-500 h-1 rounded-full w-1/3" />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>15:20</span>
                    <span>45:00</span>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}