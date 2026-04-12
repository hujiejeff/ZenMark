import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Search, 
  Trash2, 
  ExternalLink, 
  Settings, 
  Download, 
  Upload, 
  LayoutGrid, 
  List, 
  Tag, 
  ChevronRight,
  Loader2,
  Bookmark as BookmarkIcon,
  X,
  Globe,
  ChevronDown,
  Edit2,
  Cloud,
  RefreshCcw,
  FileJson,
  FileCode
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  UniqueIdentifier,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  useDndContext,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Bookmark {
  id: number;
  title: string;
  url: string;
  category: string;
  icon?: string;
  created_at: string;
  padding?: number;
  roundness?: number;
}

const STORAGE_KEYS = {
  BOOKMARKS: 'zenmark_bookmarks',
  CATEGORIES: 'zenmark_categories',
  SETTINGS: 'zenmark_settings',
  SEARCH_ENGINES: 'zenmark_search_engines',
  WEBDAV: 'zenmark_webdav'
};

const DEFAULT_UI_SETTINGS = {
  itemSize: 120,
  roundness: 30,
  itemPadding: 16,
  gridColumns: 6,
  minSpacing: 48,
  useAutoColumns: true,
  searchBarWidth: 800,
  searchBarHeight: 64,
  searchBarRoundness: 100,
  searchBarTop: 40,
  glassBlur: 64,
  glassOpacity: 70,
  wallpaper: {
    type: 'none' as 'none' | 'bing' | 'unsplash' | 'file',
    url: '',
  }
};

const DEFAULT_WEBDAV_SETTINGS = {
  url: '',
  username: '',
  password: '',
  path: '/zenmark_backup.json',
  autoSync: false
};

const DEFAULT_SEARCH_ENGINES = [
  { name: "Google", url: "https://www.google.com/search?q=", icon: "https://www.google.com/favicon.ico" },
  { name: "Bing", url: "https://www.bing.com/search?q=", icon: "https://www.bing.com/favicon.ico" },
  { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=", icon: "https://duckduckgo.com/favicon.ico" },
  { name: "Baidu", url: "https://www.baidu.com/s?wd=", icon: "https://www.baidu.com/favicon.ico" },
];

const DEFAULT_BOOKMARKS: Bookmark[] = [
  { id: 1, title: "Google", url: "https://www.google.com", category: "Search", created_at: new Date().toISOString() },
  { id: 2, title: "GitHub", url: "https://github.com", category: "Tech", created_at: new Date().toISOString() },
  { id: 3, title: "YouTube", url: "https://www.youtube.com", category: "Video", created_at: new Date().toISOString() },
  { id: 4, title: "Twitter / X", url: "https://twitter.com", category: "Social", created_at: new Date().toISOString() },
  { id: 5, title: "Reddit", url: "https://www.reddit.com", category: "Social", created_at: new Date().toISOString() },
  { id: 6, title: "Stack Overflow", url: "https://stackoverflow.com", category: "Tech", created_at: new Date().toISOString() },
  { id: 7, title: "ChatGPT", url: "https://chat.openai.com", category: "AI", created_at: new Date().toISOString() },
  { id: 8, title: "Dribbble", url: "https://dribbble.com", category: "Design", created_at: new Date().toISOString() },
  { id: 9, title: "Netflix", url: "https://www.netflix.com", category: "Entertainment", created_at: new Date().toISOString() },
  { id: 10, title: "Wikipedia", url: "https://www.wikipedia.org", category: "Learning", created_at: new Date().toISOString() },
];

const DEFAULT_CATEGORIES = ["Search", "Tech", "Video", "Social", "AI", "Design", "Entertainment", "Learning"];

export default function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchEngines, setSearchEngines] = useState(DEFAULT_SEARCH_ENGINES);
  const [selectedEngine, setSelectedEngine] = useState(DEFAULT_SEARCH_ENGINES[0]);
  const [newEngine, setNewEngine] = useState({ name: "", url: "", icon: "" });
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("appearance");
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newBookmark, setNewBookmark] = useState({ title: "", url: "", category: "" });
  const [newFolder, setNewFolder] = useState("");
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [renamingFolderData, setRenamingFolderData] = useState({ oldName: "", newName: "" });
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [isEngineDropdownOpen, setIsEngineDropdownOpen] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'bookmark' | 'folder', id: number | string } | null>(null);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");

  const [uiSettings, setUiSettings] = useState(DEFAULT_UI_SETTINGS);
  const [webdavSettings, setWebdavSettings] = useState(DEFAULT_WEBDAV_SETTINGS);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const htmlFileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);

  const handleWallpaperFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUiSettings(prev => ({ 
          ...prev, 
          wallpaper: { 
            type: 'file', 
            url: reader.result as string 
          } 
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Load from localStorage
    const savedBookmarks = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    const savedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const savedEngines = localStorage.getItem(STORAGE_KEYS.SEARCH_ENGINES);
    const savedWebdav = localStorage.getItem(STORAGE_KEYS.WEBDAV);

    if (savedBookmarks) {
      setBookmarks(JSON.parse(savedBookmarks));
    } else {
      setBookmarks(DEFAULT_BOOKMARKS);
    }

    if (savedCategories) {
      setCategoryOrder(JSON.parse(savedCategories));
    } else {
      setCategoryOrder(DEFAULT_CATEGORIES);
    }

    if (savedSettings) {
      setUiSettings(JSON.parse(savedSettings));
    }

    if (savedEngines) {
      const engines = JSON.parse(savedEngines);
      setSearchEngines(engines);
      setSelectedEngine(engines[0] || DEFAULT_SEARCH_ENGINES[0]);
    }

    if (savedWebdav) {
      const webdav = JSON.parse(savedWebdav);
      setWebdavSettings(webdav);
      
      // Auto-restore on first load if enabled
      if (webdav.autoSync && webdav.url && webdav.username && webdav.password) {
        setTimeout(() => {
          handleWebdavRestore(true); // silent restore
        }, 1000);
      }
    }

    setIsLoading(false);
    setIsFirstLoad(false);
  }, []);

  // Auto-backup logic
  useEffect(() => {
    if (isLoading || isFirstLoad || !webdavSettings.autoSync || !webdavSettings.url) return;

    const timeoutId = setTimeout(() => {
      handleWebdavBackup(true); // silent backup
    }, 5000); // 5 second debounce

    return () => clearTimeout(timeoutId);
  }, [bookmarks, categoryOrder, uiSettings, searchEngines, webdavSettings.autoSync, isLoading, isFirstLoad]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    }
  }, [bookmarks, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categoryOrder));
    }
  }, [categoryOrder, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(uiSettings));
    }
  }, [uiSettings, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.SEARCH_ENGINES, JSON.stringify(searchEngines));
    }
  }, [searchEngines, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.WEBDAV, JSON.stringify(webdavSettings));
    }
  }, [webdavSettings, isLoading]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, type: 'bookmark' | 'folder', id: number | string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      id
    });
  };

  const addFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolder.trim()) return;
    
    if (!categoryOrder.includes(newFolder)) {
      setCategoryOrder([...categoryOrder, newFolder]);
    }
    
    setNewFolder("");
    setIsAddingFolder(false);
  };

  const addBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookmark.title || !newBookmark.url) return;

    let category = newBookmark.category === 'new' ? newCategoryName : (newBookmark.category || "Uncategorized");
    
    // If it's a new category, add it to the list
    if (category !== "Uncategorized" && !categoryOrder.includes(category)) {
      setCategoryOrder(prev => [...prev, category]);
    }

    const bookmark: Bookmark = {
      id: Date.now(),
      title: newBookmark.title,
      url: newBookmark.url,
      category: category,
      created_at: new Date().toISOString()
    };

    setBookmarks([bookmark, ...bookmarks]);
    setNewBookmark({ title: "", url: "", category: "" });
    setNewCategoryName("");
    setIsAdding(false);
  };

  const renameFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const { oldName, newName } = renamingFolderData;
    if (!newName.trim() || oldName === newName) {
      setIsRenamingFolder(false);
      return;
    }

    // Update local state
    setBookmarks(prev => prev.map(b => b.category === oldName ? { ...b, category: newName } : b));
    setCategoryOrder(prev => prev.map(c => c === oldName ? newName : c));
    
    if (activeFolder === oldName) {
      setActiveFolder(newName);
    }

    setIsRenamingFolder(false);
  };

  const deleteBookmark = (id: number) => {
    setBookmarks(bookmarks.filter((b) => b.id !== id));
  };

  const updateBookmark = (id: number, updates: Partial<Bookmark>) => {
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const updateBookmarkCategory = (id: number, category: string) => {
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, category } : b));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const url = selectedEngine.url.includes('%s') 
        ? selectedEngine.url.replace('%s', encodeURIComponent(searchQuery))
        : `${selectedEngine.url}${encodeURIComponent(searchQuery)}`;
      window.open(url, "_blank");
    }
  };

  const addSearchEngine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEngine.name || !newEngine.url) return;
    
    const engine = {
      ...newEngine,
      icon: newEngine.icon || `https://www.google.com/s2/favicons?domain=${new URL(newEngine.url).hostname}&sz=64`
    };
    
    setSearchEngines([...searchEngines, engine]);
    setNewEngine({ name: "", url: "", icon: "" });
  };

  const deleteSearchEngine = (name: string) => {
    const updated = searchEngines.filter(e => e.name !== name);
    setSearchEngines(updated);
    if (selectedEngine.name === name) {
      setSelectedEngine(updated[0] || DEFAULT_SEARCH_ENGINES[0]);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const customCollisionDetection = (args: any) => {
    const { active, droppableContainers } = args;
    const isBookmark = typeof active.id === 'number';

    // 1. If we are dragging a bookmark and a folder is open
    if (activeFolder && isBookmark) {
      // Check if we are over the folder content area first
      const contentCollision = pointerWithin({
        ...args,
        droppableContainers: droppableContainers.filter((c: any) => c.id === 'folder-content-area')
      });
      
      if (contentCollision.length > 0) {
        return closestCenter(args);
      }

      // If not over content, prioritize the background to allow closing the folder
      // Use rectIntersection for background to be more sensitive
      const backgroundCollision = rectIntersection({
        ...args,
        droppableContainers: droppableContainers.filter((c: any) => c.id === 'folder-overlay-bg')
      });
      if (backgroundCollision.length > 0) {
        return backgroundCollision;
      }
    }

    // 2. For dropping into folders, use pointerWithin to be precise (macOS style)
    const folderContainers = droppableContainers.filter((c: any) => 
      typeof c.id === 'string' && c.id.startsWith('folder-') && 
      c.id !== 'folder-overlay-bg' && c.id !== 'folder-content-area'
    );
    
    const folderCollisions = pointerWithin({
      ...args,
      droppableContainers: folderContainers
    });
    
    if (folderCollisions.length > 0) {
      // Mark these as precise hits
      return folderCollisions.map(c => ({ ...c, data: { isPrecise: true } }));
    }

    // 3. For reordering bookmarks, use closestCenter
    // If dragging a bookmark, we prefer reordering with other bookmarks
    if (isBookmark) {
      const bookmarkContainers = droppableContainers.filter((c: any) => typeof c.id === 'number');
      if (bookmarkContainers.length > 0) {
        return closestCenter({ ...args, droppableContainers: bookmarkContainers });
      }
    }

    return closestCenter(args);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    // Folder close logic: if dragging an item and move over the background
    if (activeFolder && overId === 'folder-overlay-bg') {
      setActiveFolder(null);
      return;
    }

    // Optimistic moving between categories for smooth "drag-into"
    if (typeof activeId === 'number') {
      const activeBookmark = bookmarks.find(b => b.id === activeId);
      if (!activeBookmark) return;

      let newCategory: string | null = null;

      if (typeof overId === 'string' && overId.startsWith('folder-')) {
        newCategory = overId.replace('folder-', '');
      } else if (overId === 'main-grid') {
        newCategory = 'Uncategorized';
      } else if (typeof overId === 'number') {
        const overBookmark = bookmarks.find(b => b.id === overId);
        if (overBookmark) {
          newCategory = overBookmark.category || 'Uncategorized';
        }
      }

      if (newCategory && activeBookmark.category !== newCategory) {
        setBookmarks(prev => {
          const activeIndex = prev.findIndex(b => b.id === activeId);
          const overIndex = typeof overId === 'number' ? prev.findIndex(b => b.id === overId) : activeIndex;
          
          const updated = prev.map(b => b.id === activeId ? { ...b, category: newCategory! } : b);
          if (activeIndex !== overIndex && overIndex !== -1) {
            return arrayMove(updated, activeIndex, overIndex);
          }
          return updated;
        });
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Case 1: Dragging a bookmark
    if (typeof activeId === 'number') {
      const activeBookmark = bookmarks.find(b => b.id === activeId);
      if (!activeBookmark) return;

      // Finalize reordering or category move
      if (typeof overId === 'number') {
        const overBookmark = bookmarks.find(b => b.id === overId);
        if (overBookmark) {
          const oldIndex = bookmarks.findIndex(b => b.id === activeId);
          const newIndex = bookmarks.findIndex(b => b.id === overId);
          
          if (activeBookmark.category === overBookmark.category) {
            setBookmarks(arrayMove(bookmarks, oldIndex, newIndex));
          } else {
            const newCategory = overBookmark.category || 'Uncategorized';
            updateBookmarkCategory(activeId, newCategory);
          }
        }
      }
      else if (typeof overId === 'string' && overId.startsWith('folder-')) {
        const newCategory = overId.replace('folder-', '');
        if (activeBookmark.category !== newCategory) {
          updateBookmarkCategory(activeId, newCategory);
        }
      }
      else if (overId === 'main-grid') {
        if (activeBookmark.category !== 'Uncategorized') {
          updateBookmarkCategory(activeId, 'Uncategorized');
        }
      }
    }
    // Case 2: Dragging a folder
    else if (typeof activeId === 'string' && activeId.startsWith('folder-')) {
      const activeCategory = activeId.replace('folder-', '');
      
      if (typeof overId === 'string' && overId.startsWith('folder-')) {
        const overCategory = overId.replace('folder-', '');
        const oldIndex = categoryOrder.indexOf(activeCategory);
        const newIndex = categoryOrder.indexOf(overCategory);
        if (oldIndex !== -1 && newIndex !== -1) {
          setCategoryOrder(arrayMove(categoryOrder, oldIndex, newIndex));
        }
      }
    }
  };

  const categories = categoryOrder;

  const groupedBookmarks = categories.reduce((acc, cat: string) => {
    acc[cat] = bookmarks.filter(b => b.category === cat);
    return acc;
  }, {} as Record<string, Bookmark[]>);

  const standaloneBookmarks = bookmarks.filter(b => !b.category || b.category === 'Uncategorized');

  const handleResetUI = () => {
    if (confirm("Are you sure you want to reset all UI settings to default?")) {
      setUiSettings(DEFAULT_UI_SETTINGS);
    }
  };

  const handleExport = () => {
    const data = {
      bookmarks,
      categories: categoryOrder,
      settings: uiSettings,
      searchEngines,
      version: '1.1',
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zenmark_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHTML = () => {
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

    // Group bookmarks by category
    const grouped = categoryOrder.reduce((acc, cat) => {
      acc[cat] = bookmarks.filter(b => b.category === cat);
      return acc;
    }, {} as Record<string, Bookmark[]>);

    categoryOrder.forEach(cat => {
      if (grouped[cat].length > 0) {
        html += `    <DT><H3 ADD_DATE="${Math.floor(Date.now()/1000)}" LAST_MODIFIED="${Math.floor(Date.now()/1000)}">${cat}</H3>\n    <DL><p>\n`;
        grouped[cat].forEach(b => {
          html += `        <DT><A HREF="${b.url}" ADD_DATE="${Math.floor(Date.now()/1000)}">${b.title}</A>\n`;
        });
        html += `    </DL><p>\n`;
      }
    });

    // Standalone
    const standalone = bookmarks.filter(b => !b.category || b.category === 'Uncategorized');
    standalone.forEach(b => {
      html += `    <DT><A HREF="${b.url}" ADD_DATE="${Math.floor(Date.now()/1000)}">${b.title}</A>\n`;
    });

    html += `</DL><p>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zenmark_bookmarks_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.bookmarks && Array.isArray(data.bookmarks)) {
          setBookmarks(data.bookmarks);
        }
        if (data.categories && Array.isArray(data.categories)) {
          setCategoryOrder(data.categories);
        }
        if (data.settings) {
          setUiSettings(prev => ({ ...prev, ...data.settings }));
        }
        if (data.searchEngines && Array.isArray(data.searchEngines)) {
          setSearchEngines(data.searchEngines);
        }
        
        alert("Import successful!");
      } catch (err) {
        console.error("Failed to parse JSON backup:", err);
        alert("Failed to import. Please make sure the file is a valid ZenMark JSON backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportHTML = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, "text/html");
        const links = doc.querySelectorAll("a");
        
        const newBookmarks: Bookmark[] = [];
        const newCategories = new Set<string>();

        links.forEach((link, index) => {
          const url = link.getAttribute("href");
          const title = link.textContent || "Untitled";
          
          // Try to find category (H3 in parent DL)
          let category = "Uncategorized";
          let parent = link.parentElement;
          while (parent) {
            const h3 = parent.previousElementSibling;
            if (h3 && h3.tagName === 'H3') {
              category = h3.textContent || "Uncategorized";
              break;
            }
            parent = parent.parentElement;
          }

          if (url) {
            newBookmarks.push({
              id: Date.now() + index,
              title,
              url,
              category,
              created_at: new Date().toISOString()
            });
            if (category !== "Uncategorized") {
              newCategories.add(category);
            }
          }
        });

        if (newBookmarks.length > 0) {
          setBookmarks(newBookmarks);
          setCategoryOrder(Array.from(newCategories));
          setUiSettings(DEFAULT_UI_SETTINGS); // Reset UI for HTML import
          alert(`Successfully imported ${newBookmarks.length} bookmarks! UI settings have been reset to default.`);
        } else {
          alert("No bookmarks found in the HTML file.");
        }
      } catch (err) {
        console.error("Failed to parse HTML bookmarks:", err);
        alert("Failed to import HTML. Please make sure it's a valid Netscape Bookmark file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleWebdavBackup = async (silent = false) => {
    if (!webdavSettings.url) {
      if (!silent) {
        alert("Please configure WebDAV settings first.");
        setSettingsTab('data');
      }
      return;
    }

    try {
      const data = {
        bookmarks,
        categories: categoryOrder,
        settings: uiSettings,
        searchEngines,
        version: '1.1',
        exportDate: new Date().toISOString()
      };

      const auth = btoa(`${webdavSettings.username}:${webdavSettings.password}`);
      const fullUrl = webdavSettings.url.endsWith('/') 
        ? webdavSettings.url + webdavSettings.path.substring(1)
        : webdavSettings.url + webdavSettings.path;

      const response = await fetch(fullUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data, null, 2)
      });

      if (response.ok) {
        if (!silent) alert("WebDAV Backup successful!");
      } else {
        throw new Error(`WebDAV Error: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error("WebDAV Backup failed:", err);
      if (!silent) alert(`WebDAV Backup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleWebdavRestore = async (silent = false) => {
    if (!webdavSettings.url) {
      if (!silent) {
        alert("Please configure WebDAV settings first.");
        setSettingsTab('data');
      }
      return;
    }

    if (!silent && !confirm("This will overwrite all current bookmarks and settings. Continue?")) return;

    try {
      const auth = btoa(`${webdavSettings.username}:${webdavSettings.password}`);
      const fullUrl = webdavSettings.url.endsWith('/') 
        ? webdavSettings.url + webdavSettings.path.substring(1)
        : webdavSettings.url + webdavSettings.path;

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.bookmarks && Array.isArray(data.bookmarks)) {
          setBookmarks(data.bookmarks);
        }
        if (data.categories && Array.isArray(data.categories)) {
          setCategoryOrder(data.categories);
        }
        if (data.settings) {
          setUiSettings(prev => ({ ...prev, ...data.settings }));
        }
        if (data.searchEngines && Array.isArray(data.searchEngines)) {
          setSearchEngines(data.searchEngines);
        }
        
        if (!silent) alert("WebDAV Restore successful!");
      } else {
        throw new Error(`WebDAV Error: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error("WebDAV Restore failed:", err);
      if (!silent) alert(`WebDAV Restore failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="min-h-screen relative text-[#1C1C1E] font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Wallpaper Background */}
      {uiSettings.wallpaper.type !== 'none' && (
        <div className="fixed inset-0 z-0">
          <img 
            src={uiSettings.wallpaper.url} 
            alt="" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/5" />
        </div>
      )}
      
      <div className={`relative z-10 min-h-screen ${uiSettings.wallpaper.type === 'none' ? 'bg-[#F2F2F7]' : ''}`}>
        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <main className="max-w-[1600px] mx-auto p-12 lg:p-20 pt-24">
          {/* Hero Search Section */}
          <div 
            className="mx-auto mb-24 transition-all duration-500"
            style={{ 
              maxWidth: `${uiSettings.searchBarWidth}px`,
              marginTop: `${uiSettings.searchBarTop}px`,
              zIndex: isEngineDropdownOpen ? 50 : 10,
              position: 'relative'
            }}
          >
            <form onSubmit={handleSearchSubmit} className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 blur-2xl group-focus-within:opacity-100 opacity-0 transition-opacity duration-700" />
              <div 
                className="relative flex items-center shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-black/5 transition-all duration-500 group-focus-within:shadow-[0_20px_60px_rgba(0,0,0,0.08)] group-focus-within:-translate-y-1"
                style={{ 
                  borderRadius: `${(uiSettings.searchBarHeight / 2) * (uiSettings.searchBarRoundness / 100)}px`,
                  height: `${uiSettings.searchBarHeight}px`,
                  backdropFilter: `blur(${uiSettings.glassBlur}px)`,
                  backgroundColor: `rgba(255, 255, 255, ${uiSettings.glassOpacity / 100})`
                }}
              >
                <div 
                  className="relative h-full flex items-center"
                  onMouseEnter={() => setIsEngineDropdownOpen(true)}
                  onMouseLeave={() => setIsEngineDropdownOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => setIsEngineDropdownOpen(!isEngineDropdownOpen)}
                    className="flex items-center gap-3 px-6 h-full hover:bg-black/5 transition-colors"
                    style={{ 
                      borderTopLeftRadius: `${(uiSettings.searchBarHeight / 2) * (uiSettings.searchBarRoundness / 100)}px`, 
                      borderBottomLeftRadius: `${(uiSettings.searchBarHeight / 2) * (uiSettings.searchBarRoundness / 100)}px` 
                    }}
                  >
                    <img src={selectedEngine.icon} alt="" className="w-8 h-8 rounded-xl shadow-sm" />
                    <ChevronDown className={`w-4 h-4 text-black/20 transition-transform duration-300 ${isEngineDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isEngineDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full left-4 mt-3 bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-black/5 overflow-hidden z-40 p-2 flex gap-1.5 min-w-max"
                      >
                        {searchEngines.map((eng) => (
                          <button
                            key={eng.name}
                            type="button"
                            onClick={() => {
                              setSelectedEngine(eng);
                              setIsEngineDropdownOpen(false);
                            }}
                            title={eng.name}
                            className={`p-3 rounded-2xl transition-all duration-300 ${selectedEngine.name === eng.name ? 'bg-blue-500 shadow-lg shadow-blue-500/20 scale-110' : 'hover:bg-black/5'}`}
                          >
                            <img src={eng.icon} alt={eng.name} className={`w-8 h-8 rounded-lg ${selectedEngine.name === eng.name ? 'brightness-110' : ''}`} />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="w-px h-1/2 bg-black/5" />
                <div className="relative flex-1 h-full">
                  <input 
                    type="text" 
                    placeholder={`Search with ${selectedEngine.name}...`}
                    className="w-full h-full px-6 bg-transparent outline-none text-lg font-medium placeholder:text-black/20"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button 
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-black/5 rounded-full text-black/20 hover:text-black transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 text-black/20">
              <Loader2 className="w-12 h-12 animate-spin mb-4 text-blue-500" />
              <p className="text-sm font-bold tracking-tight">Loading Launchpad...</p>
            </div>
          ) : (
            <div className="space-y-20">
              {/* Unified Grid Area */}
              <div className="space-y-8">
                <DroppableArea id="main-grid">
                  <div 
                    className="grid justify-items-center"
                    style={{ 
                      gridTemplateColumns: uiSettings.useAutoColumns 
                        ? `repeat(auto-fill, minmax(${uiSettings.itemSize}px, 1fr))` 
                        : `repeat(${uiSettings.gridColumns}, minmax(0, 1fr))`,
                      gap: `${uiSettings.minSpacing}px` 
                    }}
                  >
                    <SortableContext items={[...categories.map(c => `folder-${c}`), ...standaloneBookmarks.map(b => b.id)]} strategy={rectSortingStrategy}>
                      <AnimatePresence mode="popLayout">
                        {/* Folders first */}
                        {categories.map((category) => (
                          <FolderItem 
                            key={`folder-${category}`} 
                            category={category} 
                            items={groupedBookmarks[category] || []} 
                            onClick={() => setActiveFolder(category)} 
                            onRename={() => {
                              setRenamingFolderData({ oldName: category, newName: category });
                              setIsRenamingFolder(true);
                            }}
                            onContextMenu={(e) => handleContextMenu(e, 'folder', category)}
                            settings={uiSettings}
                          />
                        ))}
                        
                        {/* Standalone Bookmarks */}
                        {standaloneBookmarks.map((bookmark) => (
                          <BookmarkItem 
                            key={`bookmark-${bookmark.id}`} 
                            bookmark={bookmark} 
                            onDelete={() => deleteBookmark(bookmark.id)} 
                            onContextMenu={(e) => handleContextMenu(e, 'bookmark', bookmark.id)}
                            settings={uiSettings}
                          />
                        ))}
                      </AnimatePresence>
                    </SortableContext>
                  </div>
                </DroppableArea>
              </div>

              {/* Empty State */}
              {!isLoading && bookmarks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-black/20">
                  <BookmarkIcon className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-bold tracking-tight">No bookmarks yet. Add some to get started!</p>
                </div>
              )}
            </div>
          )}
        </main>

      {/* macOS Launchpad Folder Overlay */}
      <AnimatePresence>
        {activeFolder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 sm:p-20">
            <DroppableArea id="folder-overlay-bg" className="absolute inset-0">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveFolder(null)}
                className="w-full h-full bg-black/60 backdrop-blur-[40px]"
              />
            </DroppableArea>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-6xl"
            >
              <DroppableArea 
                id="folder-content-area" 
                className="w-full h-full bg-white/10 backdrop-blur-md rounded-[4rem] p-12 sm:p-20 shadow-[0_50px_100px_rgba(0,0,0,0.3)] border border-white/10"
              >
                <div className="flex flex-col items-center mb-16">
                  <h2 className="text-5xl font-extrabold tracking-tight text-white drop-shadow-2xl mb-4">
                    {activeFolder}
                  </h2>
                  <div className="w-24 h-1 bg-white/20 rounded-full" />
                </div>

                <div 
                  className="grid justify-items-center max-h-[65vh] overflow-y-auto px-6 custom-scrollbar"
                  style={{ 
                    gridTemplateColumns: uiSettings.useAutoColumns 
                      ? `repeat(auto-fill, minmax(${uiSettings.itemSize}px, 1fr))` 
                      : `repeat(${uiSettings.gridColumns}, minmax(0, 1fr))`,
                    gap: `${uiSettings.minSpacing}px` 
                  }}
                >
                  <SortableContext items={groupedBookmarks[activeFolder]?.map(b => b.id) || []} strategy={rectSortingStrategy}>
                    {groupedBookmarks[activeFolder]?.map((bookmark) => (
                      <BookmarkItem 
                        key={bookmark.id} 
                        bookmark={bookmark} 
                        onDelete={() => deleteBookmark(bookmark.id)} 
                        onContextMenu={(e) => handleContextMenu(e, 'bookmark', bookmark.id)}
                        settings={uiSettings}
                        inFolder 
                      />
                    ))}
                  </SortableContext>
                </div>
              </DroppableArea>

              <button 
                onClick={() => setActiveFolder(null)}
                className="absolute top-10 right-10 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-md border border-white/10"
              >
                <X className="w-7 h-7" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold tracking-tight">Add Bookmark</h2>
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="p-2 hover:bg-black/5 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={addBookmark} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-1">Title</label>
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="e.g. Google AI Studio"
                      className="w-full px-4 py-3 bg-black/5 border-transparent focus:bg-white focus:border-black/10 rounded-2xl outline-none transition-all"
                      value={newBookmark.title}
                      onChange={(e) => setNewBookmark({ ...newBookmark, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-1">URL</label>
                    <input 
                      type="url" 
                      placeholder="https://..."
                      className="w-full px-4 py-3 bg-black/5 border-transparent focus:bg-white focus:border-black/10 rounded-2xl outline-none transition-all"
                      value={newBookmark.url}
                      onChange={(e) => setNewBookmark({ ...newBookmark, url: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-1">Folder / Category (Optional)</label>
                    <div className="relative">
                      <select 
                        className="w-full px-4 py-3 bg-black/5 border-transparent focus:bg-white focus:border-black/10 rounded-2xl outline-none transition-all appearance-none"
                        value={newBookmark.category}
                        onChange={(e) => setNewBookmark({ ...newBookmark, category: e.target.value })}
                      >
                        <option value="Uncategorized">Uncategorized (Standalone)</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="new">+ Create New Category</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/20 pointer-events-none" />
                    </div>
                    {newBookmark.category === 'new' && (
                      <input 
                        type="text" 
                        placeholder="Enter new category name..."
                        className="w-full mt-2 px-4 py-3 bg-black/5 border-transparent focus:bg-white focus:border-black/10 rounded-2xl outline-none transition-all"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        required
                      />
                    )}
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Add Bookmark
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Drawer */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-white shadow-2xl flex overflow-hidden"
            >
              {/* Left Column: Navigation */}
              <div className="w-64 bg-[#F9F9F9] border-r border-black/5 p-8 flex flex-col gap-2">
                <h2 className="text-xl font-bold mb-8 px-2">Settings</h2>
                {[
                  { id: 'appearance', label: 'Appearance', icon: LayoutGrid },
                  { id: 'wallpaper', label: 'Wallpaper', icon: Globe },
                  { id: 'search', label: 'Search', icon: Search },
                  { id: 'data', label: 'Data & Sync', icon: Download },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSettingsTab(item.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${settingsTab === item.id ? 'bg-white shadow-sm text-blue-600' : 'text-black/40 hover:bg-black/5'}`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
                
                <div className="mt-auto pt-8 border-t border-black/5">
                  <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest px-2">ZenMark v1.0</p>
                </div>
              </div>

              {/* Right Column: Content */}
              <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-12">
                  <h3 className="text-2xl font-bold capitalize">{settingsTab}</h3>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-2 hover:bg-black/5 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {settingsTab === 'appearance' && (
                  <div className="space-y-12">
                    <div className="space-y-6">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-black/30">Grid Display</h4>
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold">Item Size</label>
                            <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded-md">{uiSettings.itemSize}px</span>
                          </div>
                          <input 
                            type="range" min="80" max="240" step="4"
                            value={uiSettings.itemSize}
                            onChange={(e) => setUiSettings({ ...uiSettings, itemSize: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold">Roundness</label>
                            <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded-md">{uiSettings.roundness}%</span>
                          </div>
                          <input 
                            type="range" min="0" max="100" step="1"
                            value={uiSettings.roundness}
                            onChange={(e) => setUiSettings({ ...uiSettings, roundness: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold">Icon Padding</label>
                            <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded-md">{uiSettings.itemPadding}px</span>
                          </div>
                          <input 
                            type="range" min="0" max="48" step="2"
                            value={uiSettings.itemPadding}
                            onChange={(e) => setUiSettings({ ...uiSettings, itemPadding: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold">Min Spacing</label>
                            <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded-md">{uiSettings.minSpacing}px</span>
                          </div>
                          <input 
                            type="range" min="16" max="128" step="4"
                            value={uiSettings.minSpacing}
                            onChange={(e) => setUiSettings({ ...uiSettings, minSpacing: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-black/5 rounded-2xl">
                          <div className="space-y-0.5">
                            <label className="text-sm font-bold">Auto Columns</label>
                            <p className="text-[10px] text-black/40">Adjust columns based on icon size</p>
                          </div>
                          <button 
                            onClick={() => setUiSettings({ ...uiSettings, useAutoColumns: !uiSettings.useAutoColumns })}
                            className={`w-12 h-6 rounded-full transition-all relative ${uiSettings.useAutoColumns ? 'bg-blue-500' : 'bg-black/10'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${uiSettings.useAutoColumns ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                        {!uiSettings.useAutoColumns && (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <label className="text-sm font-bold">Grid Columns</label>
                              <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded-md">{uiSettings.gridColumns}</span>
                            </div>
                            <input 
                              type="range" min="2" max="12" step="1"
                              value={uiSettings.gridColumns}
                              onChange={(e) => setUiSettings({ ...uiSettings, gridColumns: parseInt(e.target.value) })}
                              className="w-full h-1.5 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-black/30">Search Bar</h4>
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold">Width</label>
                            <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded-md">{uiSettings.searchBarWidth}px</span>
                          </div>
                          <input 
                            type="range" min="400" max="1200" step="10"
                            value={uiSettings.searchBarWidth}
                            onChange={(e) => setUiSettings({ ...uiSettings, searchBarWidth: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold">Height</label>
                            <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded-md">{uiSettings.searchBarHeight}px</span>
                          </div>
                          <input 
                            type="range" min="48" max="96" step="2"
                            value={uiSettings.searchBarHeight}
                            onChange={(e) => setUiSettings({ ...uiSettings, searchBarHeight: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold">Roundness</label>
                            <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded-md">{uiSettings.searchBarRoundness}%</span>
                          </div>
                          <input 
                            type="range" min="0" max="100" step="1"
                            value={uiSettings.searchBarRoundness}
                            onChange={(e) => setUiSettings({ ...uiSettings, searchBarRoundness: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold">Top Margin</label>
                            <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded-md">{uiSettings.searchBarTop}px</span>
                          </div>
                          <input 
                            type="range" min="0" max="200" step="5"
                            value={uiSettings.searchBarTop}
                            onChange={(e) => setUiSettings({ ...uiSettings, searchBarTop: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-black/30">Glass Effect</h4>
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold">Blur Intensity</label>
                            <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded-md">{uiSettings.glassBlur}px</span>
                          </div>
                          <input 
                            type="range" min="0" max="64" step="1"
                            value={uiSettings.glassBlur}
                            onChange={(e) => setUiSettings({ ...uiSettings, glassBlur: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold">Opacity</label>
                            <span className="text-xs font-mono bg-black/5 px-2 py-1 rounded-md">{uiSettings.glassOpacity}%</span>
                          </div>
                          <input 
                            type="range" min="0" max="100" step="1"
                            value={uiSettings.glassOpacity}
                            onChange={(e) => setUiSettings({ ...uiSettings, glassOpacity: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-black/5">
                      <button 
                        onClick={handleResetUI}
                        className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all"
                      >
                        <RefreshCcw className="w-4 h-4" />
                        Reset UI to Default
                      </button>
                    </div>
                  </div>
                )}
                
                {settingsTab === 'wallpaper' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'none', label: 'Default', color: 'bg-gray-200' },
                        { id: 'bing', label: 'Bing Daily', color: 'bg-blue-400' },
                        { id: 'unsplash', label: 'Unsplash Random', color: 'bg-indigo-400' },
                        { id: 'file', label: 'Local File', color: 'bg-green-400' },
                        { id: 'local', label: 'Custom URL', color: 'bg-purple-400' },
                      ].map(wp => (
                        <button
                          key={wp.id}
                          onClick={() => {
                            if (wp.id === 'file') {
                              wallpaperFileInputRef.current?.click();
                              return;
                            }
                            let url = '';
                            if (wp.id === 'bing') url = 'https://bing.biturl.top/?resolution=3840&format=image&index=0&mkt=zh-CN';
                            if (wp.id === 'unsplash') url = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=3840&q=100';
                            setUiSettings({ ...uiSettings, wallpaper: { type: wp.id, url } });
                          }}
                          className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${uiSettings.wallpaper.type === wp.id ? 'border-blue-500 bg-blue-50' : 'border-black/5 hover:border-black/10'}`}
                        >
                          <div className={`w-12 h-12 rounded-full ${wp.color}`} />
                          <span className="text-sm font-bold">{wp.label}</span>
                        </button>
                      ))}
                    </div>

                    <input 
                      type="file" 
                      ref={wallpaperFileInputRef} 
                      onChange={handleWallpaperFileChange} 
                      className="hidden" 
                      accept="image/*" 
                    />

                    {uiSettings.wallpaper.type === 'local' && (
                      <div className="space-y-4 p-6 bg-black/5 rounded-2xl">
                        <label className="text-xs font-bold uppercase tracking-widest text-black/40">Wallpaper URL</label>
                        <input 
                          type="text" 
                          placeholder="https://images.unsplash.com/..."
                          className="w-full px-4 py-3 bg-white border-transparent focus:border-black/10 rounded-xl outline-none transition-all"
                          value={uiSettings.wallpaper.url}
                          onChange={(e) => setUiSettings({ ...uiSettings, wallpaper: { ...uiSettings.wallpaper, url: e.target.value } })}
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {settingsTab === 'search' && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      {searchEngines.map(eng => (
                        <div key={eng.name} className="flex items-center justify-between p-4 bg-black/5 rounded-2xl group">
                          <div className="flex items-center gap-4">
                            <img src={eng.icon} alt="" className="w-8 h-8 rounded-lg shadow-sm" />
                            <div>
                              <p className="text-sm font-bold">{eng.name}</p>
                              <p className="text-[10px] text-black/40 truncate max-w-[180px]">{eng.url}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => deleteSearchEngine(eng.name)}
                            className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 rounded-xl"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="p-6 bg-black/5 rounded-3xl space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <Plus className="w-4 h-4 text-black/30" />
                        <span className="text-sm font-bold">Add Engine</span>
                      </div>
                      <form onSubmit={addSearchEngine} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input 
                            type="text" 
                            placeholder="Name"
                            className="w-full px-4 py-2.5 bg-white border border-black/5 rounded-xl outline-none text-sm"
                            value={newEngine.name}
                            onChange={e => setNewEngine({...newEngine, name: e.target.value})}
                            required
                          />
                          <input 
                            type="text" 
                            placeholder="Icon URL"
                            className="w-full px-4 py-2.5 bg-white border border-black/5 rounded-xl outline-none text-sm"
                            value={newEngine.icon}
                            onChange={e => setNewEngine({...newEngine, icon: e.target.value})}
                          />
                        </div>
                        <input 
                          type="text" 
                          placeholder="Search URL (use %s for query)"
                          className="w-full px-4 py-2.5 bg-white border border-black/5 rounded-xl outline-none text-sm"
                          value={newEngine.url}
                          onChange={e => setNewEngine({...newEngine, url: e.target.value})}
                          required
                        />
                        <button 
                          type="submit"
                          className="w-full bg-black text-white py-2.5 rounded-xl text-xs font-bold hover:opacity-90 transition-all"
                        >
                          Add Engine
                        </button>
                      </form>
                    </div>
                  </div>
                )}
                
                {settingsTab === 'data' && (
                  <div className="space-y-6">
                    {/* WebDAV Section */}
                    <div className="p-6 bg-black/5 rounded-3xl space-y-6">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <Cloud className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-bold">WebDAV</span>
                        </div>
                        <button 
                          onClick={() => setWebdavSettings({ ...webdavSettings, autoSync: !webdavSettings.autoSync })}
                          className={`w-8 h-4 rounded-full transition-all relative ${webdavSettings.autoSync ? 'bg-blue-600' : 'bg-black/10'}`}
                        >
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${webdavSettings.autoSync ? 'left-4.5' : 'left-0.5'}`} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <input 
                          type="text" 
                          placeholder="Server URL"
                          className="w-full px-4 py-2.5 bg-white border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
                          value={webdavSettings.url}
                          onChange={e => setWebdavSettings({...webdavSettings, url: e.target.value})}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <input 
                            type="text" 
                            placeholder="User"
                            className="w-full px-4 py-2.5 bg-white border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
                            value={webdavSettings.username}
                            onChange={e => setWebdavSettings({...webdavSettings, username: e.target.value})}
                          />
                          <input 
                            type="password" 
                            placeholder="Pass"
                            className="w-full px-4 py-2.5 bg-white border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
                            value={webdavSettings.password}
                            onChange={e => setWebdavSettings({...webdavSettings, password: e.target.value})}
                          />
                        </div>
                        <input 
                          type="text" 
                          placeholder="Path"
                          className="w-full px-4 py-2.5 bg-white border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-sm"
                          value={webdavSettings.path}
                          onChange={e => setWebdavSettings({...webdavSettings, path: e.target.value})}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleWebdavRestore(false)}
                          className="flex-1 py-2.5 bg-white text-black/60 rounded-xl text-xs font-bold hover:bg-black/5 transition-all border border-black/5"
                        >
                          Restore
                        </button>
                        <button 
                          onClick={() => handleWebdavBackup(false)}
                          className="flex-1 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all"
                        >
                          Backup
                        </button>
                      </div>
                    </div>

                    {/* Local Backup Section */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-white border border-black/5 rounded-2xl flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <FileJson className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-bold">JSON</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 py-2 bg-black/5 rounded-lg text-[10px] font-bold hover:bg-black/10 transition-all"
                          >
                            Import
                          </button>
                          <button 
                            onClick={handleExport}
                            className="flex-1 py-2 bg-black text-white rounded-lg text-[10px] font-bold hover:opacity-90 transition-all"
                          >
                            Export
                          </button>
                        </div>
                      </div>

                      <div className="p-4 bg-white border border-black/5 rounded-2xl flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <FileCode className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-bold">HTML</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => htmlFileInputRef.current?.click()}
                            className="flex-1 py-2 bg-black/5 rounded-lg text-[10px] font-bold hover:bg-black/10 transition-all"
                          >
                            Import
                          </button>
                          <button 
                            onClick={handleExportHTML}
                            className="flex-1 py-2 bg-black text-white rounded-lg text-[10px] font-bold hover:opacity-90 transition-all"
                          >
                            Export
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
                    <input type="file" ref={htmlFileInputRef} onChange={handleImportHTML} className="hidden" accept=".html" />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 right-8 flex items-center gap-4 z-40">
        <div className="relative group">
          <div className="absolute bottom-full right-0 pb-4 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all translate-y-4 group-hover:translate-y-0 flex flex-col items-end gap-2">
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-white text-black px-6 py-3 rounded-2xl text-sm font-bold shadow-xl hover:bg-gray-50 transition-all whitespace-nowrap flex items-center gap-2 border border-black/5"
            >
              <BookmarkIcon className="w-4 h-4 text-blue-500" />
              Add Bookmark
            </button>
            <button 
              onClick={() => setIsAddingFolder(true)}
              className="bg-white text-black px-6 py-3 rounded-2xl text-sm font-bold shadow-xl hover:bg-gray-50 transition-all whitespace-nowrap flex items-center gap-2 border border-black/5"
            >
              <LayoutGrid className="w-4 h-4 text-indigo-500" />
              Add Folder
            </button>
          </div>

          <button 
            className="w-14 h-14 bg-black text-white shadow-2xl rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="w-14 h-14 bg-white shadow-2xl rounded-full flex items-center justify-center text-black/40 hover:text-blue-600 transition-all hover:scale-110 active:scale-95 border border-black/5"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Add Folder Modal */}
      <AnimatePresence>
        {isAddingFolder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingFolder(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold tracking-tight">Add Folder</h2>
                  <button 
                    onClick={() => setIsAddingFolder(false)}
                    className="p-2 hover:bg-black/5 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={addFolder} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-1">Folder Name</label>
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="e.g. Work, Social, News"
                      className="w-full px-4 py-3 bg-black/5 border-transparent focus:bg-white focus:border-black/10 rounded-2xl outline-none transition-all"
                      value={newFolder}
                      onChange={(e) => setNewFolder(e.target.value)}
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Create Folder
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rename Folder Modal */}
      <AnimatePresence>
        {isRenamingFolder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRenamingFolder(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold tracking-tight">Rename Folder</h2>
                  <button 
                    onClick={() => setIsRenamingFolder(false)}
                    className="p-2 hover:bg-black/5 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={renameFolder} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-1">New Name</label>
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Enter new folder name..."
                      className="w-full px-4 py-3 bg-black/5 border-transparent focus:bg-white focus:border-black/10 rounded-2xl outline-none transition-all"
                      value={renamingFolderData.newName}
                      onChange={(e) => setRenamingFolderData({ ...renamingFolderData, newName: e.target.value })}
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                  >
                    <Edit2 className="w-5 h-5" />
                    Rename Folder
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isImporting && (
          <div className="fixed inset-0 z-[60] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-black mb-6" />
            <h2 className="text-2xl font-bold tracking-tight mb-2">Importing Bookmarks</h2>
            <p className="text-black/40">This might take a moment depending on the size of your file.</p>
          </div>
        )}
      </AnimatePresence>

      <DragOverlay dropAnimation={null}>
        {activeId ? (
          <div 
            className="bg-white/80 backdrop-blur-xl shadow-2xl border border-black/5 flex items-center justify-center opacity-80 scale-110 overflow-hidden"
            style={{ 
              width: `${uiSettings.itemSize}px`, 
              height: `${uiSettings.itemSize}px`,
              borderRadius: `${uiSettings.itemSize * (uiSettings.roundness / 100) * 0.5}px`
            }}
          >
            {typeof activeId === 'number' ? (
              <img 
                src={`https://www.google.com/s2/favicons?domain=${bookmarks.find(b => b.id === activeId)?.url}&sz=128`} 
                alt="" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="grid grid-cols-3 grid-rows-3 gap-2 p-4 w-full h-full">
                {groupedBookmarks[String(activeId).replace('folder-', '')]?.slice(0, 9).map((item) => (
                  <div 
                    key={item.id} 
                    className="w-full h-full bg-white/80 rounded-sm flex items-center justify-center overflow-hidden border border-black/5"
                    style={{ borderRadius: `${(uiSettings.itemSize * (uiSettings.roundness / 100) * 0.5) / 4}px` }}
                  >
                    <img 
                      src={`https://www.google.com/s2/favicons?domain=${item.url}&sz=64`} 
                      alt="" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </DragOverlay>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-[200] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-black/5 overflow-hidden py-2 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.type === 'bookmark' ? (
              <>
                <button
                  onClick={() => {
                    const bookmark = bookmarks.find(b => b.id === contextMenu.id);
                    if (bookmark) setEditingBookmark(bookmark);
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-3 hover:bg-black/5 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Bookmark
                </button>
                <button
                  onClick={() => {
                    deleteBookmark(Number(contextMenu.id));
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-3 hover:bg-red-50 text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Bookmark
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setRenamingFolderData({ oldName: String(contextMenu.id), newName: String(contextMenu.id) });
                    setIsRenamingFolder(true);
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-3 hover:bg-black/5 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Rename Folder
                </button>
                <button
                  onClick={() => {
                    // Logic to delete folder (delete all bookmarks in category)
                    if (confirm(`Are you sure you want to delete the folder "${contextMenu.id}" and all its bookmarks?`)) {
                      const categoryName = String(contextMenu.id);
                      
                      const bookmarksToDelete = bookmarks.filter(b => b.category === categoryName);
                      bookmarksToDelete.forEach(b => deleteBookmark(b.id));
                      
                      setCategoryOrder(prev => prev.filter(c => c !== categoryName));
                    }
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm font-bold flex items-center gap-3 hover:bg-red-50 text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Folder
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Bookmark Modal */}
      <AnimatePresence>
        {editingBookmark && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingBookmark(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold tracking-tight">Edit Bookmark</h2>
                  <button 
                    onClick={() => setEditingBookmark(null)}
                    className="p-2 hover:bg-black/5 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingBookmark) {
                      updateBookmark(editingBookmark.id, editingBookmark);
                      setEditingBookmark(null);
                    }
                  }} 
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-1">Title</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-black/5 border-transparent focus:bg-white focus:border-black/10 rounded-2xl outline-none transition-all"
                      value={editingBookmark.title || ""}
                      onChange={(e) => setEditingBookmark({ ...editingBookmark, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-1">URL</label>
                    <input 
                      type="url" 
                      className="w-full px-4 py-3 bg-black/5 border-transparent focus:bg-white focus:border-black/10 rounded-2xl outline-none transition-all"
                      value={editingBookmark.url || ""}
                      onChange={(e) => setEditingBookmark({ ...editingBookmark, url: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-1">Padding</label>
                        <span className="text-[10px] font-mono bg-black/5 px-1.5 py-0.5 rounded">
                          {(editingBookmark.padding ?? uiSettings.itemPadding)}px
                          {editingBookmark.padding != null && (
                            <span className="ml-1 text-blue-500 font-bold uppercase text-[8px]">Custom</span>
                          )}
                        </span>
                      </div>
                      <input 
                        type="range" min="0" max="48" step="2"
                        value={editingBookmark.padding ?? uiSettings.itemPadding}
                        onChange={(e) => setEditingBookmark({ ...editingBookmark, padding: parseInt(e.target.value) })}
                        className="w-full h-1 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold uppercase tracking-widest text-black/40 ml-1">Roundness</label>
                        <span className="text-[10px] font-mono bg-black/5 px-1.5 py-0.5 rounded">
                          {(editingBookmark.roundness ?? uiSettings.roundness)}%
                          {editingBookmark.roundness != null && (
                            <span className="ml-1 text-blue-500 font-bold uppercase text-[8px]">Custom</span>
                          )}
                        </span>
                      </div>
                      <input 
                        type="range" min="0" max="100" step="5"
                        value={editingBookmark.roundness ?? uiSettings.roundness}
                        onChange={(e) => setEditingBookmark({ ...editingBookmark, roundness: parseInt(e.target.value) })}
                        className="w-full h-1 bg-black/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button 
                      type="button"
                      onClick={() => setEditingBookmark({ ...editingBookmark, padding: null, roundness: null })}
                      className="flex-1 px-4 py-3 bg-black/5 text-black/60 rounded-2xl font-bold hover:bg-black/10 transition-all text-sm"
                    >
                      Reset to Global
                    </button>
                    <button 
                      type="submit" 
                      className="flex-[2] bg-black text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DndContext>
  </div>
</div>
);
}

function DroppableArea({ id, children, className, style }: { id: string, children: React.ReactNode, className?: string, style?: React.CSSProperties }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className || `w-full transition-all duration-500 ${isOver ? 'bg-black/5 rounded-[3rem] p-8 -m-8' : ''}`} style={style}>
      {children}
    </div>
  );
}

function FolderItem({ category, items, onClick, onRename, onContextMenu, settings }: { category: string, items: Bookmark[], onClick: () => void, onRename: (e: React.MouseEvent) => void, onContextMenu: (e: React.MouseEvent) => void, settings: any, key?: React.Key }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `folder-${category}`,
  });

  const { collisions, active } = useDndContext();
  
  // Only highlight if it's a precise collision and we are dragging a bookmark
  const isPreciseOver = active && typeof active.id === 'number' && 
    collisions?.some(c => c.id === `folder-${category}` && c.data?.isPrecise);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    width: `${settings.itemSize}px`,
  };

  const borderRadius = settings.itemSize * (settings.roundness / 100) * 0.5;

  return (
    <motion.div
      layout
      style={style}
      className={`group flex flex-col items-center cursor-pointer transition-all duration-300 ${isPreciseOver ? 'scale-110' : ''}`}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e);
      }}
    >
      <div 
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`relative w-full aspect-square mb-5 border grid grid-cols-3 grid-rows-3 transition-all duration-500 group-hover:bg-white/60 group-hover:shadow-[0_25px_60px_rgba(0,0,0,0.12)] group-hover:-translate-y-2 active:scale-95 ${isPreciseOver ? 'border-blue-500 bg-blue-500/15 ring-4 ring-blue-500/20' : 'border-black/5'}`}
        style={{ 
          borderRadius: `${borderRadius}px`,
          padding: `${settings.itemPadding}px`,
          gap: `${settings.itemPadding / 2}px`,
          backdropFilter: `blur(${settings.glassBlur}px)`,
          backgroundColor: `rgba(255, 255, 255, ${settings.glassOpacity / 100})`
        }}
      >
        {/* 3x3 Grid of Mini Icons - only show existing ones */}
        {items.slice(0, 9).map((item) => (
          <div 
            key={item.id} 
            className="w-full h-full bg-white/90 shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center justify-center overflow-hidden border border-black/5"
            style={{ borderRadius: `${borderRadius / 4}px` }}
          >
            <img 
              src={`https://www.google.com/s2/favicons?domain=${item.url}&sz=64`} 
              alt="" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        ))}
      </div>
      <div className="text-center w-full px-1 pointer-events-none">
        <h3 className="text-[15px] font-bold text-[#1C1C1E] line-clamp-1 leading-tight tracking-tight">
          {category}
        </h3>
      </div>
    </motion.div>
  );
}

function BookmarkItem({ bookmark, onDelete, onContextMenu, inFolder, settings }: { bookmark: Bookmark, onDelete: () => void, onContextMenu: (e: React.MouseEvent) => void, inFolder?: boolean, settings: any, key?: React.Key }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bookmark.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    width: `${settings.itemSize}px`,
  };

  // Inherit from global settings if not set individually
  const itemPadding = bookmark.padding ?? settings.itemPadding;
  const itemRoundness = bookmark.roundness ?? settings.roundness;
  const borderRadius = settings.itemSize * (itemRoundness / 100) * 0.5;

  return (
    <motion.div
      layout
      style={style}
      className="group flex flex-col items-center"
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e);
      }}
    >
      <div ref={setNodeRef} {...attributes} {...listeners} className="relative w-full aspect-square mb-4">
        <a 
          href={bookmark.url} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`block w-full h-full ${itemPadding > 0 ? 'bg-white border border-black/5' : 'bg-transparent'} shadow-sm flex items-center justify-center transition-all duration-500 group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] group-hover:-translate-y-2 active:scale-95 overflow-hidden ${inFolder ? 'shadow-xl' : ''}`}
          style={{ 
            borderRadius: `${borderRadius}px`,
            padding: `${itemPadding}px`
          }}
        >
          <img 
            src={`https://www.google.com/s2/favicons?domain=${bookmark.url}&sz=128`} 
            alt="" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </a>
      </div>
      <div className="text-center w-full px-1 pointer-events-none">
        <h3 className={`text-[14px] font-bold line-clamp-1 leading-tight drop-shadow-sm ${inFolder ? 'text-white' : 'text-[#1C1C1E]'}`}>
          {bookmark.title}
        </h3>
      </div>
    </motion.div>
  );
}
