import React, { useState, useEffect, useRef } from 'react';
import { Search, TrendingUp, Clock, Tag, Star, Zap, Brain, BarChart3, History, Plus } from 'lucide-react';

// Trie Node with metadata
class TrieNode {
  constructor() {
    this.children = {};
    this.isEndOfWord = false;
    this.frequency = 0;
    this.timestamp = Date.now();
    this.category = '';
    this.directAnswer = '';
    this.relatedTerms = [];
    this.isUserGenerated = false;
  }
}

// Trie Data Structure
class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word, metadata = {}) {
    let node = this.root;
    for (let char of word.toLowerCase()) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }
    node.isEndOfWord = true;
    node.frequency = metadata.frequency !== undefined ? metadata.frequency : node.frequency + 1;
    node.timestamp = metadata.timestamp || Date.now();
    node.category = metadata.category || node.category || 'User Search';
    node.directAnswer = metadata.directAnswer || node.directAnswer || '';
    node.relatedTerms = metadata.relatedTerms || node.relatedTerms || [];
    node.isUserGenerated = metadata.isUserGenerated !== undefined ? metadata.isUserGenerated : node.isUserGenerated;
    return node;
  }

  search(prefix) {
    let node = this.root;
    for (let char of prefix.toLowerCase()) {
      if (!node.children[char]) return [];
      node = node.children[char];
    }
    return this.getAllWords(node, prefix.toLowerCase());
  }

  getAllWords(node, prefix, results = []) {
    if (node.isEndOfWord) {
      results.push({
        term: prefix,
        frequency: node.frequency,
        timestamp: node.timestamp,
        category: node.category,
        directAnswer: node.directAnswer,
        relatedTerms: node.relatedTerms,
        isUserGenerated: node.isUserGenerated
      });
    }
    for (let char in node.children) {
      this.getAllWords(node.children[char], prefix + char, results);
    }
    return results;
  }

  exists(word) {
    let node = this.root;
    for (let char of word.toLowerCase()) {
      if (!node.children[char]) return false;
      node = node.children[char];
    }
    return node.isEndOfWord;
  }
}

// ML-based Intent Predictor
class IntentPredictor {
  predict(query) {
    const intents = {
      'how': 'question',
      'what': 'definition',
      'where': 'location',
      'when': 'time',
      'why': 'explanation',
      'buy': 'commerce',
      'price': 'commerce',
      'learn': 'educational'
    };
    
    const words = query.toLowerCase().split(' ');
    for (let word of words) {
      if (intents[word]) return intents[word];
    }
    return 'general';
  }

  calculateRelevance(term, query, intent) {
    let score = 0;
    
    // Exact match bonus
    if (term.toLowerCase().includes(query.toLowerCase())) {
      score += 50;
    }
    
    // Prefix match bonus (higher priority)
    if (term.toLowerCase().startsWith(query.toLowerCase())) {
      score += 40;
    }
    
    // Intent match bonus
    const termIntent = this.predict(term);
    if (termIntent === intent) {
      score += 30;
    }
    
    // Recency bonus (searches within last hour)
    const hoursSinceSearch = (Date.now() - (term.timestamp || Date.now())) / 3600000;
    if (hoursSinceSearch < 1) {
      score += 25;
    } else if (hoursSinceSearch < 24) {
      score += 10;
    }
    
    // Length similarity
    const lengthDiff = Math.abs(term.length - query.length);
    score += Math.max(0, 20 - lengthDiff);
    
    return score;
  }
}

// Initialize sample data
const initializeSampleData = () => {
  const trie = new Trie();
  const sampleData = [
    { term: 'machine learning basics', category: 'AI', frequency: 150, directAnswer: 'Machine learning is a subset of AI that enables systems to learn from data.' },
    { term: 'machine learning algorithms', category: 'AI', frequency: 120, directAnswer: 'Common algorithms include neural networks, decision trees, and SVMs.' },
    { term: 'react hooks tutorial', category: 'Programming', frequency: 200, directAnswer: 'React Hooks are functions that let you use state and lifecycle features in functional components.' },
    { term: 'react native development', category: 'Programming', frequency: 180 },
    { term: 'python data science', category: 'Programming', frequency: 190 },
    { term: 'python web scraping', category: 'Programming', frequency: 95 },
    { term: 'javascript promises', category: 'Programming', frequency: 140 },
    { term: 'javascript async await', category: 'Programming', frequency: 160 },
    { term: 'docker containers explained', category: 'DevOps', frequency: 110 },
    { term: 'kubernetes orchestration', category: 'DevOps', frequency: 85 },
    { term: 'aws cloud services', category: 'Cloud', frequency: 175 },
    { term: 'azure deployment', category: 'Cloud', frequency: 90 },
    { term: 'neural networks deep learning', category: 'AI', frequency: 130 },
    { term: 'natural language processing', category: 'AI', frequency: 105 },
    { term: 'database optimization tips', category: 'Database', frequency: 88 },
    { term: 'sql query performance', category: 'Database', frequency: 92 }
  ];

  sampleData.forEach(item => {
    trie.insert(item.term, {
      frequency: item.frequency,
      category: item.category,
      directAnswer: item.directAnswer,
      timestamp: Date.now() - Math.random() * 10000000,
      isUserGenerated: false
    });
  });

  return trie;
};

const UnifiedSearchPortal = () => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [intent, setIntent] = useState('');
  const [analytics, setAnalytics] = useState({ searches: 0, avgTime: 0, newTerms: 0 });
  const [directAnswer, setDirectAnswer] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [showNewTermNotification, setShowNewTermNotification] = useState(false);
  const [lastAddedTerm, setLastAddedTerm] = useState('');
  
  const trieRef = useRef(initializeSampleData());
  const predictorRef = useRef(new IntentPredictor());
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  const rankSuggestions = (results, query, intent) => {
    return results
      .map(result => ({
        ...result,
        mlScore: predictorRef.current.calculateRelevance(result.term, query, intent)
      }))
      .sort((a, b) => {
        // Prioritize user-generated terms that are recent
        if (a.isUserGenerated && !b.isUserGenerated) {
          const aRecency = (Date.now() - a.timestamp) / 3600000; // hours
          if (aRecency < 24) return -1; // Recent user term gets priority
        }
        if (!a.isUserGenerated && b.isUserGenerated) {
          const bRecency = (Date.now() - b.timestamp) / 3600000;
          if (bRecency < 24) return 1;
        }
        
        // Combine frequency, freshness, and ML score
        const recencyBonus = (term) => {
          const hours = (Date.now() - term.timestamp) / 3600000;
          if (hours < 1) return 30;
          if (hours < 24) return 15;
          return 0;
        };
        
        const scoreA = a.mlScore + (a.frequency * 0.5) + recencyBonus(a);
        const scoreB = b.mlScore + (b.frequency * 0.5) + recencyBonus(b);
        return scoreB - scoreA;
      })
      .slice(0, 8);
  };

  const addNewSearchTerm = (term) => {
    const trimmedTerm = term.trim().toLowerCase();
    if (!trimmedTerm) return false;

    const exists = trieRef.current.exists(trimmedTerm);
    
    if (!exists) {
      // Add new term to Trie
      trieRef.current.insert(trimmedTerm, {
        frequency: 1,
        category: 'User Search',
        timestamp: Date.now(),
        isUserGenerated: true
      });

      // Update analytics
      setAnalytics(prev => ({
        ...prev,
        newTerms: prev.newTerms + 1
      }));

      // Show notification
      setLastAddedTerm(trimmedTerm);
      setShowNewTermNotification(true);
      setTimeout(() => setShowNewTermNotification(false), 3000);

      // Add to recent searches
      setRecentSearches(prev => {
        const updated = [trimmedTerm, ...prev.filter(s => s !== trimmedTerm)].slice(0, 10);
        return updated;
      });

      return true;
    } else {
      // Update existing term frequency and timestamp
      trieRef.current.insert(trimmedTerm, {
        timestamp: Date.now()
      });

      // Update recent searches
      setRecentSearches(prev => {
        const updated = [trimmedTerm, ...prev.filter(s => s !== trimmedTerm)].slice(0, 10);
        return updated;
      });

      return false;
    }
  };

  const handleSearch = (searchQuery) => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      setDirectAnswer('');
      return;
    }

    const startTime = performance.now();
    
    // Trie search
    const trieResults = trieRef.current.search(searchQuery);
    
    // Intent prediction
    const predictedIntent = predictorRef.current.predict(searchQuery);
    setIntent(predictedIntent);
    
    // ML-based ranking
    const rankedResults = rankSuggestions(trieResults, searchQuery, predictedIntent);
    
    setSuggestions(rankedResults);
    setShowDropdown(true);
    
    // Check for direct answer
    const exactMatch = rankedResults.find(r => 
      r.term.toLowerCase() === searchQuery.toLowerCase()
    );
    if (exactMatch && exactMatch.directAnswer) {
      setDirectAnswer(exactMatch.directAnswer);
    } else {
      setDirectAnswer('');
    }
    
    const endTime = performance.now();
    setAnalytics(prev => ({
      ...prev,
      searches: prev.searches + 1,
      avgTime: (prev.avgTime * prev.searches + (endTime - startTime)) / (prev.searches + 1)
    }));
  };

  const debouncedSearch = (value) => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      handleSearch(value);
    }, 150);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown && e.key === 'Enter') {
      // User pressed Enter without selecting a suggestion
      e.preventDefault();
      if (query.trim()) {
        const isNew = addNewSearchTerm(query);
        if (!isNew) {
          // Re-search to show updated results
          handleSearch(query);
        }
      }
      return;
    }

    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          selectSuggestion(suggestions[selectedIndex]);
        } else if (query.trim()) {
          addNewSearchTerm(query);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const selectSuggestion = (suggestion) => {
    setQuery(suggestion.term);
    setShowDropdown(false);
    setSelectedIndex(-1);
    
    // Update frequency and timestamp
    trieRef.current.insert(suggestion.term, {
      frequency: suggestion.frequency + 1,
      category: suggestion.category,
      directAnswer: suggestion.directAnswer,
      timestamp: Date.now(),
      isUserGenerated: suggestion.isUserGenerated
    });

    // Add to recent searches
    setRecentSearches(prev => {
      const updated = [suggestion.term, ...prev.filter(s => s !== suggestion.term)].slice(0, 10);
      return updated;
    });
  };

  const selectRecentSearch = (term) => {
    setQuery(term);
    handleSearch(term);
    
    // Update frequency
    trieRef.current.insert(term, {
      timestamp: Date.now()
    });
  };

  const getCategoryColor = (category) => {
    const colors = {
      'AI': 'bg-purple-100 text-purple-700',
      'Programming': 'bg-blue-100 text-blue-700',
      'DevOps': 'bg-green-100 text-green-700',
      'Cloud': 'bg-cyan-100 text-cyan-700',
      'Database': 'bg-orange-100 text-orange-700',
      'User Search': 'bg-pink-100 text-pink-700'
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  const getIntentIcon = (intent) => {
    const icons = {
      'question': Brain,
      'definition': Tag,
      'commerce': Star,
      'educational': BarChart3
    };
    return icons[intent] || Search;
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const IntentIcon = getIntentIcon(intent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Zap className="w-10 h-10 text-blue-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Adaptive Search Portal
            </h1>
          </div>
          <p className="text-gray-600">Self-learning search with Trie indexing and ML ranking</p>
        </div>

        {/* New Term Notification */}
        {showNewTermNotification && (
          <div className="mb-4 p-4 bg-green-50 border-2 border-green-300 rounded-xl shadow-lg animate-pulse">
            <div className="flex items-center gap-3">
              <Plus className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">New term learned!</p>
                <p className="text-sm text-green-700">
                  Added "<span className="font-mono">{lastAddedTerm}</span>" to search database
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search Interface */}
        <div className="relative mb-6" ref={inputRef}>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => query && setShowDropdown(true)}
              placeholder="Type anything to search or create new terms..."
              className="w-full px-6 py-4 pr-12 text-lg border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:outline-none shadow-lg transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {intent && <IntentIcon className="w-5 h-5 text-gray-400" />}
              <Search className="w-6 h-6 text-gray-400" />
            </div>
          </div>

          {/* Suggestions Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-10">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => selectSuggestion(suggestion)}
                  className={`px-6 py-4 cursor-pointer transition-colors ${
                    index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  } ${index < suggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 truncate">
                          {suggestion.term}
                        </span>
                        {suggestion.category && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(suggestion.category)}`}>
                            {suggestion.category}
                          </span>
                        )}
                        {suggestion.isUserGenerated && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
                            <Plus className="w-3 h-3" />
                            New
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {suggestion.frequency} searches
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {Math.floor((Date.now() - suggestion.timestamp) / 3600000)}h ago
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-blue-600 font-medium whitespace-nowrap">
                      Score: {suggestion.mlScore}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Direct Answer Box */}
        {directAnswer && (
          <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl shadow-md">
            <div className="flex items-start gap-3">
              <Brain className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Direct Answer</h3>
                <p className="text-gray-700">{directAnswer}</p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="mb-6 p-5 bg-white rounded-xl shadow-md border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-600" />
              Recent Searches
            </h3>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((term, index) => (
                <button
                  key={index}
                  onClick={() => selectRecentSearch(term)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 rounded-lg text-sm transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
            <div className="flex items-center gap-3">
              <Search className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{analytics.searches}</div>
                <div className="text-sm text-gray-600">Total Searches</div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
            <div className="flex items-center gap-3">
              <Plus className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900">{analytics.newTerms}</div>
                <div className="text-sm text-gray-600">New Terms Learned</div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {analytics.avgTime.toFixed(2)}ms
                </div>
                <div className="text-sm text-gray-600">Avg Response</div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-purple-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900 capitalize">{intent || 'N/A'}</div>
                <div className="text-sm text-gray-600">Current Intent</div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-white rounded-xl shadow-md border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Self-Learning Database
            </h3>
            <p className="text-sm text-gray-600">
              Automatically adds new search terms and learns from user behavior
            </p>
          </div>
          <div className="p-5 bg-white rounded-xl shadow-md border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Dynamic Suggestions
            </h3>
            <p className="text-sm text-gray-600">
              Related terms appear as you type based on your search history
            </p>
          </div>
          <div className="p-5 bg-white rounded-xl shadow-md border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              Recency Prioritization
            </h3>
            <p className="text-sm text-gray-600">
              Recent searches get higher ranking in suggestions
            </p>
          </div>
          <div className="p-5 bg-white rounded-xl shadow-md border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-600" />
              Search History
            </h3>
            <p className="text-sm text-gray-600">
              Quick access to your recent searches with one click
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
          <p className="text-sm text-gray-700 mb-2">
            <strong>🎯 Try it out:</strong>
          </p>
          <ul className="text-sm text-gray-600 space-y-1 ml-4">
            <li>• Type "mac" and press Enter to add it to the database</li>
            <li>• Then type "macos" and press Enter - it will be added too</li>
            <li>• Now type "mac" again - you'll see both "mac" and "macos" suggested!</li>
            <li>• Try "macbook", "macbook pro", etc. The system learns all variations</li>
            <li>• Recent searches appear below with one-click access</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UnifiedSearchPortal;