'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Bookmark, MapPin, Clock, Star, Trash2, Share, Tag } from 'lucide-react'

interface BookmarkItem {
  id: string
  title: string
  description: string
  location: string
  timestamp: Date
  tags: string[]
  rating?: number
  notes?: string
  type: 'restaurant' | 'attraction' | 'hotel' | 'experience' | 'other'
}

const sampleBookmarks: BookmarkItem[] = [
  {
    id: '1',
    title: 'Trattoria da Valentino',
    description: 'Amazing carbonara and friendly staff. Must try the tiramisu!',
    location: 'Rome, Italy',
    timestamp: new Date('2024-01-15'),
    tags: ['Italian', 'Pasta', 'Authentic'],
    rating: 5,
    type: 'restaurant',
    notes: 'Ask for table by the window'
  },
  {
    id: '2',
    title: 'Hidden Garden Café',
    description: 'Secret rooftop garden with incredible city views',
    location: 'Paris, France',
    timestamp: new Date('2024-01-10'),
    tags: ['Coffee', 'Views', 'Hidden Gem'],
    rating: 4,
    type: 'restaurant'
  },
  {
    id: '3',
    title: 'Street Art Alley',
    description: 'Incredible murals and local art scene',
    location: 'Berlin, Germany',
    timestamp: new Date('2024-01-08'),
    tags: ['Art', 'Street Art', 'Photography'],
    type: 'attraction'
  }
]

interface BookmarksProps {
  isOpen: boolean
  onClose: () => void
}

export function Bookmarks({ isOpen, onClose }: BookmarksProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(sampleBookmarks)
  const [filter, setFilter] = useState<string>('all')

  const getTypeIcon = (type: BookmarkItem['type']) => {
    switch (type) {
      case 'restaurant': return '🍽️'
      case 'attraction': return '🏛️'
      case 'hotel': return '🏨'
      case 'experience': return '🎭'
      default: return '📍'
    }
  }

  const getTypeColor = (type: BookmarkItem['type']) => {
    switch (type) {
      case 'restaurant': return 'text-orange-400 bg-orange-400/20'
      case 'attraction': return 'text-blue-400 bg-blue-400/20'
      case 'hotel': return 'text-purple-400 bg-purple-400/20'
      case 'experience': return 'text-green-400 bg-green-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  const filteredBookmarks = filter === 'all' 
    ? bookmarks 
    : bookmarks.filter(bookmark => bookmark.type === filter)

  const deleteBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(bookmark => bookmark.id !== id))
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
                <Bookmark className="w-8 h-8 text-blue-400" />
                <div>
                  <h2 className="text-2xl font-bold text-white">My Bookmarks</h2>
                  <p className="text-gray-400">Your saved travel memories</p>
                </div>
              </div>
              <Button variant="ghost" onClick={onClose}>
                ✕
              </Button>
            </div>

            {/* Filter Tabs */}
            <div className="flex space-x-2 mb-6 overflow-x-auto">
              {['all', 'restaurant', 'attraction', 'hotel', 'experience', 'other'].map((type) => (
                <Button
                  key={type}
                  variant={filter === type ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(type)}
                  className="whitespace-nowrap"
                >
                  {type === 'all' ? 'All' : `${getTypeIcon(type as BookmarkItem['type'])} ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                </Button>
              ))}
            </div>

            {/* Bookmarks List */}
            <div className="space-y-4">
              <AnimatePresence>
                {filteredBookmarks.map((bookmark) => (
                  <motion.div
                    key={bookmark.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="glass rounded-xl p-4 border border-white/20 hover:border-blue-400/50 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-2xl">{getTypeIcon(bookmark.type)}</span>
                          <div>
                            <h3 className="text-lg font-bold text-white">{bookmark.title}</h3>
                            <div className="flex items-center space-x-2 text-sm text-gray-400">
                              <MapPin className="w-4 h-4" />
                              <span>{bookmark.location}</span>
                              <span>•</span>
                              <Clock className="w-4 h-4" />
                              <span>{bookmark.timestamp.toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-gray-300 mb-3">{bookmark.description}</p>

                        {bookmark.rating && (
                          <div className="flex items-center space-x-1 mb-3">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < bookmark.rating! 
                                    ? 'text-yellow-400 fill-yellow-400' 
                                    : 'text-gray-600'
                                }`}
                              />
                            ))}
                          </div>
                        )}

                        {bookmark.notes && (
                          <div className="mb-3">
                            <p className="text-sm text-blue-300 bg-blue-500/10 rounded-lg p-2">
                              💡 {bookmark.notes}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1 mb-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(bookmark.type)}`}>
                            {bookmark.type}
                          </span>
                          {bookmark.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-white/10 text-gray-300 text-xs rounded-md"
                            >
                              <Tag className="w-3 h-3 inline mr-1" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex space-x-2 ml-4">
                        <Button variant="ghost" size="icon">
                          <Share className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => deleteBookmark(bookmark.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {filteredBookmarks.length === 0 && (
              <div className="text-center py-12">
                <Bookmark className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-400 mb-2">No bookmarks yet</h3>
                <p className="text-gray-500">
                  Start exploring and save your favorite places!
                </p>
              </div>
            )}

            {/* Add Bookmark Button */}
            <div className="mt-6 pt-6 border-t border-white/20">
              <Button variant="gradient" className="w-full">
                <Bookmark className="w-4 h-4 mr-2" />
                Add New Bookmark
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}