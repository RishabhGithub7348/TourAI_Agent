'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
  delay?: number
}

export function FeatureCard({ icon, title, description, delay = 0 }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ 
        scale: 1.05,
        transition: { duration: 0.2 }
      }}
      className="group relative"
    >
      <div className="glass rounded-xl p-6 h-full border border-white/20 hover:border-blue-500/50 transition-all duration-300">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="relative z-10">
          <div className="mb-4 text-blue-400 group-hover:text-blue-300 transition-colors duration-300">
            {icon}
          </div>
          
          <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-100 transition-colors duration-300">
            {title}
          </h3>
          
          <p className="text-gray-300 leading-relaxed group-hover:text-gray-100 transition-colors duration-300">
            {description}
          </p>
        </div>
        
        {/* Animated border */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 p-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="h-full w-full rounded-xl bg-black/80" />
        </div>
      </div>
    </motion.div>
  )
}