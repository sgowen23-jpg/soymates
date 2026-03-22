import { useState, useRef, useEffect } from 'react'
import { STORES } from '../data/stores'
import './StoreSearchInput.css'

export default function StoreSearchInput({ value, onChange, onSelect, placeholder = 'Search store…' }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  function handleChange(e) {
    const q = e.target.value
    onChange(q)
    if (!q.trim()) { setSuggestions([]); setOpen(false); return }
    const term = q.toLowerCase()
    const matches = STORES
      .filter(s =>
        s.name.toLowerCase().includes(term) ||
        s.suburb.toLowerCase().includes(term)
      )
      .slice(0, 4)
    setSuggestions(matches)
    setOpen(matches.length > 0)
  }

  function handleSelect(store) {
    onChange(store.name)
    if (onSelect) onSelect(store)
    setSuggestions([])
    setOpen(false)
  }

  function handleClear() {
    onChange('')
    setSuggestions([])
    setOpen(false)
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="store-search-wrap" ref={wrapRef}>
      <div className="store-search-input-row">
        <span className="store-search-icon">🔍</span>
        <input
          className="store-search-input"
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
        />
        {value && (
          <button className="store-search-clear" onClick={handleClear}>✕</button>
        )}
      </div>

      {open && (
        <ul className="store-search-dropdown">
          {suggestions.map(s => (
            <li key={s.id} onMouseDown={() => handleSelect(s)}>
              <span className="suggestion-name">{s.name}</span>
              <span className="suggestion-meta">{s.suburb}, {s.state}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
