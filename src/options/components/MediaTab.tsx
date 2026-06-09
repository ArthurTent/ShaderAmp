import React, { useCallback, useEffect, useRef, useState } from "react";
import browser from "webextension-polyfill";
import { logger } from "@src/helpers/logger";
import {
    ArrowUpTrayIcon,
    TrashIcon,
    PhotoIcon,
    FilmIcon,
    CubeTransparentIcon,
    ExclamationCircleIcon,
    CheckCircleIcon,
    Squares2X2Icon,
    ListBulletIcon,
    XMarkIcon,
    EyeIcon,
} from "@heroicons/react/24/outline";
import {
    type CustomImage,
    uploadCustomImage,
    deleteCustomImage,
    getCustomImageBlob,
    formatBytes,
    SUPPORTED_IMAGE_EXTENSIONS,
} from "@src/helpers/customImageStorage";
import {
    type CustomVideo,
    uploadCustomVideo,
    deleteCustomVideo,
    getCustomVideoBlob,
    formatVideoBytes,
    SUPPORTED_VIDEO_EXTENSIONS,
} from "@src/helpers/customVideoStorage";
import {
    type CustomCubemap,
    uploadCustomCubemapZip,
    deleteCustomCubemap,
    formatCubemapBytes,
} from "@src/helpers/customCubemapStorage";
import { getStorageQuotaDB } from "@src/storage/shaderDB";

type Notification = { message: string; type: 'success' | 'error' };
type ViewMode = 'grid' | 'list';
type PreviewItem = 
    | { type: 'image'; item: CustomImage; url: string }
    | { type: 'video'; item: CustomVideo; url: string }
    | { type: 'cubemap'; item: Omit<CustomCubemap, 'faces'> };

export default function MediaTab() {
    const [images, setImages] = useState<CustomImage[]>([]);
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [notification, setNotification] = useState<Notification | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [storageInfo, setStorageInfo] = useState<{ used: number; total: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const objectUrlsRef = useRef<Record<string, string>>({});

    // Video state
    const [videos, setVideos] = useState<CustomVideo[]>([]);
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const [deleteConfirmVideoId, setDeleteConfirmVideoId] = useState<string | null>(null);
    const [isVideoDragOver, setIsVideoDragOver] = useState(false);
    const videoInputRef = useRef<HTMLInputElement>(null);

    // Cubemap state (without faces blob data for UI)
    const [cubemaps, setCubemaps] = useState<Omit<CustomCubemap, 'faces'>[]>([]);
    const [isUploadingCubemap, setIsUploadingCubemap] = useState(false);
    const [deleteConfirmCubemapId, setDeleteConfirmCubemapId] = useState<string | null>(null);
    const [isCubemapDragOver, setIsCubemapDragOver] = useState(false);
    const cubemapInputRef = useRef<HTMLInputElement>(null);

    // View mode state
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    
    // Preview modal state
    const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null);
    
    // Video URLs state (similar to thumbnails for images)
    const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
    const videoObjectUrlsRef = useRef<Record<string, string>>({});

    // Helper to load video preview
    const loadVideoPreview = useCallback(async (video: CustomVideo) => {
        // Revoke previous URL if exists
        if (videoObjectUrlsRef.current[video.id]) {
            URL.revokeObjectURL(videoObjectUrlsRef.current[video.id]);
        }
        
        const blob = await getCustomVideoBlob(video.id);
        if (blob) {
            const url = URL.createObjectURL(blob);
            videoObjectUrlsRef.current[video.id] = url;
            setVideoUrls(prev => ({ ...prev, [video.id]: url }));
            setPreviewItem({ type: 'video', item: video, url });
        }
    }, []);

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const loadVideos = useCallback(async () => {
        logger.options.log('MediaTab', 'Loading videos...');
        // Use message passing to access background script's IndexedDB
        const response = await browser.runtime.sendMessage({ action: 'getAllCustomVideos' });
        const list = response?.success ? response.videos : [];
        logger.options.log('MediaTab', 'getAllCustomVideos returned: %d videos', list.length);
        if (list.length > 0) {
            logger.options.log('MediaTab', 'Video details: %s', JSON.stringify(list.map((v: CustomVideo) => ({ id: v.id, name: v.name, mimeType: v.mimeType, size: v.size }))));
        }
        setVideos(list);
        logger.options.log('MediaTab', 'Videos state updated');
    }, []);

    const loadCubemaps = useCallback(async () => {
        logger.options.log('MediaTab', 'Loading cubemaps...');
        // Use message passing to access background script's IndexedDB
        const response = await browser.runtime.sendMessage({ action: 'getAllCustomCubemaps' });
        const list = response?.success ? response.cubemaps : [];
        logger.options.log('MediaTab', 'Loaded %d cubemaps', list.length);
        setCubemaps(list);
    }, []);

    const loadImages = useCallback(async () => {
        logger.options.log('MediaTab', 'Loading images...');
        // Use message passing to access background script's IndexedDB
        const response = await browser.runtime.sendMessage({ action: 'getAllCustomImages' });
        const list = response?.success ? response.images : [];
        logger.options.log('MediaTab', 'Loaded images count: %d', list.length);
        list.forEach((img: CustomImage, i: number) => {
            logger.options.log('MediaTab', 'Image %d: id=%s, name=%s, mimeType=%s, addedAt=%s, source=%s, hasBlob=%s', 
                i, img.id, img.name, img.mimeType, img.addedAt, (img as any).source, 'blob' in img);
        });
        setImages(list);

        // Revoke any old object URLs before replacing
        Object.values(objectUrlsRef.current).forEach(url => URL.revokeObjectURL(url));
        objectUrlsRef.current = {};

        // Create object URLs for thumbnails
        const newThumbs: Record<string, string> = {};
        for (const img of list) {
            const blob = await getCustomImageBlob(img.id);
            if (blob) {
                const url = URL.createObjectURL(blob);
                newThumbs[img.id] = url;
            }
        }
        objectUrlsRef.current = newThumbs;
        setThumbnails(newThumbs);
    }, []);

    const loadStorageInfo = useCallback(async () => {
        const info = await getStorageQuotaDB();
        setStorageInfo(info);
    }, []);

    // Debug: Log state changes
    useEffect(() => {
        logger.options.log('MediaTab', 'Images state changed: %d', images.length);
    }, [images]);
    useEffect(() => {
        logger.options.log('MediaTab', 'Videos state changed: %d', videos.length);
    }, [videos]);
    useEffect(() => {
        logger.options.log('MediaTab', 'Cubemaps state changed: %d', cubemaps.length);
    }, [cubemaps]);

    useEffect(() => {
        loadImages();
        loadVideos();
        loadCubemaps();
        loadStorageInfo();
        return () => {
            // Revoke all object URLs on unmount
            Object.values(objectUrlsRef.current).forEach(url => URL.revokeObjectURL(url));
        };
    }, [loadImages, loadVideos, loadCubemaps, loadStorageInfo]);

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsUploading(true);
        let successCount = 0;
        let errorMessages: string[] = [];

        for (const file of Array.from(files)) {
            try {
                await uploadCustomImage(file);
                successCount++;
            } catch (err) {
                errorMessages.push(err instanceof Error ? err.message : `Failed: ${file.name}`);
            }
        }

        await loadImages();
        await loadStorageInfo();
        setIsUploading(false);

        if (errorMessages.length > 0) {
            showNotification(errorMessages[0], 'error');
        } else {
            showNotification(`${successCount} image${successCount !== 1 ? 's' : ''} uploaded successfully`, 'success');
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleVideoFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsUploadingVideo(true);
        let successCount = 0;
        const errorMessages: string[] = [];
        for (const file of Array.from(files)) {
            try {
                await uploadCustomVideo(file);
                successCount++;
            } catch (err) {
                errorMessages.push(err instanceof Error ? err.message : `Failed: ${file.name}`);
            }
        }
        await loadVideos();
        await loadStorageInfo();
        setIsUploadingVideo(false);
        if (errorMessages.length > 0) {
            showNotification(errorMessages[0], 'error');
        } else {
            showNotification(`${successCount} video${successCount !== 1 ? 's' : ''} uploaded successfully`, 'success');
        }
    };

    const handleVideoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleVideoFiles(e.target.files);
        e.target.value = '';
    };

    const handleVideoDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsVideoDragOver(false);
        handleVideoFiles(e.dataTransfer.files);
    };

    const handleDeleteVideo = async (id: string) => {
        try {
            await deleteCustomVideo(id);
            await loadVideos();
            await loadStorageInfo();
            setDeleteConfirmVideoId(null);
            showNotification('Video deleted', 'success');
        } catch {
            showNotification('Failed to delete video', 'error');
        }
    };

    // Cubemap handlers
    const handleCubemapFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsUploadingCubemap(true);
        let successCount = 0;
        let errorMessages: string[] = [];

        for (const file of Array.from(files)) {
            if (!file.name.toLowerCase().endsWith('.zip')) {
                errorMessages.push(`${file.name}: Only ZIP files are supported for cubemaps`);
                continue;
            }
            try {
                await uploadCustomCubemapZip(file);
                successCount++;
            } catch (err) {
                errorMessages.push(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`);
            }
        }

        setIsUploadingCubemap(false);
        await loadCubemaps();
        await loadStorageInfo();

        if (successCount > 0) {
            showNotification(`${successCount} cubemap${successCount > 1 ? 's' : ''} uploaded`, 'success');
        }
        if (errorMessages.length > 0) {
            showNotification(errorMessages.join('; '), 'error');
        }

        // Reset file input
        if (cubemapInputRef.current) {
            cubemapInputRef.current.value = '';
        }
    };

    const handleCubemapDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsCubemapDragOver(false);
        handleCubemapFiles(e.dataTransfer.files);
    };

    const handleDeleteCubemap = async (id: string) => {
        try {
            await deleteCustomCubemap(id);
            await loadCubemaps();
            await loadStorageInfo();
            setDeleteConfirmCubemapId(null);
            showNotification('Cubemap deleted', 'success');
        } catch {
            showNotification('Failed to delete cubemap', 'error');
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => setIsDragOver(false);

    const handleDelete = async (id: string) => {
        try {
            await deleteCustomImage(id);
            // Revoke the object URL for this image
            if (objectUrlsRef.current[id]) {
                URL.revokeObjectURL(objectUrlsRef.current[id]);
                delete objectUrlsRef.current[id];
            }
            await loadImages();
            await loadStorageInfo();
            setDeleteConfirmId(null);
            showNotification('Image deleted', 'success');
        } catch {
            showNotification('Failed to delete image', 'error');
        }
    };

    const usedPercent = storageInfo
        ? Math.min(100, (storageInfo.used / storageInfo.total) * 100)
        : 0;

    return (
        <div className="flex flex-col space-y-4 p-4 w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">Custom Media Library</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Upload images to use as textures in shader channel slots (iChannel0–3).
                        Supported formats: PNG, JPG, WebP, GIF.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* View Toggle */}
                    <div className="flex bg-gray-800 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded transition-colors ${
                                viewMode === 'grid'
                                    ? 'bg-gray-700 text-white'
                                    : 'text-gray-400 hover:text-gray-200'
                            }`}
                            title="Grid view"
                        >
                            <Squares2X2Icon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded transition-colors ${
                                viewMode === 'list'
                                    ? 'bg-gray-700 text-white'
                                    : 'text-gray-400 hover:text-gray-200'
                            }`}
                            title="List view"
                        >
                            <ListBulletIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
                        {isUploading ? 'Uploading…' : 'Upload Images'}
                    </button>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={SUPPORTED_IMAGE_EXTENSIONS}
                    multiple
                    className="hidden"
                    onChange={handleFileInput}
                />
            </div>

            {/* Notification */}
            {notification && (
                <div className={`flex items-center px-4 py-2 rounded-lg text-sm ${
                    notification.type === 'success'
                        ? 'bg-green-900/50 text-green-300'
                        : 'bg-red-900/50 text-red-300'
                }`}>
                    {notification.type === 'success'
                        ? <CheckCircleIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                        : <ExclamationCircleIcon className="w-4 h-4 mr-2 flex-shrink-0" />}
                    {notification.message}
                </div>
            )}

            {/* Drag & Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-8 cursor-pointer transition-colors ${
                    isDragOver
                        ? 'border-indigo-400 bg-indigo-900/20'
                        : 'border-gray-600 hover:border-indigo-500 hover:bg-gray-800/50'
                }`}
            >
                <PhotoIcon className="w-10 h-10 text-gray-500 mb-2" />
                <p className="text-sm text-gray-400">
                    Drag & drop images here, or <span className="text-indigo-400 underline">click to browse</span>
                </p>
                <p className="text-xs text-gray-600 mt-1">PNG · JPG · WebP · GIF</p>
            </div>

            {/* Storage indicator */}
            {storageInfo && (
                <div className="flex flex-col space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Storage used</span>
                        <span>{formatBytes(storageInfo.used)} / {formatBytes(storageInfo.total)}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full transition-all ${
                                usedPercent > 80 ? 'bg-red-500' : usedPercent > 50 ? 'bg-yellow-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${usedPercent}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Image Gallery */}
            {images.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                    <PhotoIcon className="w-12 h-12 mb-3 opacity-40" />
                    <p className="text-sm">No custom images yet.</p>
                    <p className="text-xs mt-1">Upload some images to get started.</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {images.map((img) => (
                        <div
                            key={img.id}
                            className="relative group flex flex-col bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-indigo-500 transition-colors cursor-pointer"
                            onClick={() => thumbnails[img.id] && setPreviewItem({ type: 'image', item: img, url: thumbnails[img.id] })}
                        >
                            {/* Thumbnail */}
                            <div className="w-full aspect-square bg-gray-900 flex items-center justify-center overflow-hidden relative">
                                {thumbnails[img.id] ? (
                                    <>
                                        <img
                                            src={thumbnails[img.id]}
                                            alt={img.name}
                                            className="w-full h-full object-cover"
                                        />
                                        {/* Preview overlay on hover */}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <EyeIcon className="w-8 h-8 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <PhotoIcon className="w-8 h-8 text-gray-600" />
                                )}
                            </div>

                            {/* Info */}
                            <div className="p-2 flex flex-col space-y-1">
                                <p
                                    className="text-xs text-gray-300 font-medium truncate"
                                    title={img.name}
                                >
                                    {img.name}
                                </p>
                                <p className="text-xs text-gray-500">{formatBytes(img.size)}</p>
                            </div>

                            {/* Delete button */}
                            {deleteConfirmId === img.id ? (
                                <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center space-y-2 p-2">
                                    <p className="text-xs text-red-300 text-center">Delete image?</p>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                                            className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                                            className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(img.id); }}
                                    className="absolute top-1 right-1 p-1 bg-gray-900/70 hover:bg-red-900/80 text-gray-400 hover:text-red-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete image"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                // List view
                <div className="space-y-2">
                    {images.map((img) => (
                        <div
                            key={img.id}
                            className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg border border-gray-700 hover:border-indigo-500 transition-colors cursor-pointer"
                            onClick={() => thumbnails[img.id] && setPreviewItem({ type: 'image', item: img, url: thumbnails[img.id] })}
                        >
                            {/* Thumbnail */}
                            <div className="w-16 h-16 bg-gray-900 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {thumbnails[img.id] ? (
                                    <img
                                        src={thumbnails[img.id]}
                                        alt={img.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <PhotoIcon className="w-6 h-6 text-gray-600" />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-300 font-medium truncate" title={img.name}>
                                    {img.name}
                                </p>
                                <p className="text-xs text-gray-500">{formatBytes(img.size)}</p>
                            </div>

                            {/* Preview button */}
                            {thumbnails[img.id] && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewItem({ type: 'image', item: img, url: thumbnails[img.id] });
                                    }}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                    title="Preview"
                                >
                                    <EyeIcon className="w-4 h-4" />
                                </button>
                            )}

                            {/* Delete button */}
                            {deleteConfirmId === img.id ? (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(img.id);
                                        }}
                                        className="px-2 py-1 text-xs bg-red-700 hover:bg-red-600 text-white rounded"
                                    >
                                        Delete
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteConfirmId(null);
                                        }}
                                        className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmId(img.id);
                                    }}
                                    className="p-2 text-gray-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                                    title="Delete image"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {/* ── Videos Section ── */}
            <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Custom Video Library</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Upload videos to use as textures in shader channel slots (iChannel0–3). Supported: MP4, WebM.
                        </p>
                    </div>
                    <button
                        onClick={() => videoInputRef.current?.click()}
                        disabled={isUploadingVideo}
                        className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
                        {isUploadingVideo ? 'Uploading…' : 'Upload Videos'}
                    </button>
                    <input
                        ref={videoInputRef}
                        type="file"
                        accept={SUPPORTED_VIDEO_EXTENSIONS}
                        multiple
                        className="hidden"
                        onChange={handleVideoInput}
                    />
                </div>

                {/* Video drag-and-drop zone */}
                <div
                    onDrop={handleVideoDrop}
                    onDragOver={(e) => { e.preventDefault(); setIsVideoDragOver(true); }}
                    onDragLeave={() => setIsVideoDragOver(false)}
                    onClick={() => videoInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-6 cursor-pointer transition-colors mb-4 ${
                        isVideoDragOver
                            ? 'border-teal-400 bg-teal-900/20'
                            : 'border-gray-600 hover:border-teal-500 hover:bg-gray-800/50'
                    }`}
                >
                    <FilmIcon className="w-8 h-8 text-gray-500 mb-2" />
                    <p className="text-sm text-gray-400">
                        Drag & drop videos here, or <span className="text-indigo-400 underline">click to browse</span>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">MP4 · WebM</p>
                </div>

                {/* Video Gallery */}
                {videos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-600">
                        <FilmIcon className="w-10 h-10 mb-2 opacity-40" />
                        <p className="text-sm">No custom videos yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {videos.map((vid) => (
                            <div
                                key={vid.id}
                                className="relative group flex flex-col bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-teal-500 transition-colors cursor-pointer"
                                onClick={() => loadVideoPreview(vid)}
                            >
                                <div className="w-full aspect-square bg-gray-900 flex items-center justify-center relative">
                                    <FilmIcon className="w-10 h-10 text-gray-600" />
                                    {/* Preview overlay on hover */}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <EyeIcon className="w-8 h-8 text-white" />
                                    </div>
                                </div>
                                <div className="p-2 flex flex-col space-y-1">
                                    <p className="text-xs text-gray-300 font-medium truncate" title={vid.name}>{vid.name}</p>
                                    <p className="text-xs text-gray-500">{formatVideoBytes(vid.size)}</p>
                                </div>
                                {deleteConfirmVideoId === vid.id ? (
                                    <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center space-y-2 p-2">
                                        <p className="text-xs text-red-300 text-center">Delete video?</p>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteVideo(vid.id);
                                                }}
                                                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
                                            >Delete</button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteConfirmVideoId(null);
                                                }}
                                                className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded"
                                            >Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteConfirmVideoId(vid.id);
                                        }}
                                        className="absolute top-1 right-1 p-1 bg-gray-900/70 hover:bg-red-900/80 text-gray-400 hover:text-red-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete video"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Cubemap Upload Section */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-700">
                <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                    <CubeTransparentIcon className="w-5 h-5 text-purple-400" />
                    Custom Cubemaps
                </h3>

                {/* Hidden file input for cubemap ZIP */}
                <div className="mb-4">
                    <input
                        ref={cubemapInputRef}
                        type="file"
                        accept=".zip"
                        multiple
                        onChange={(e) => handleCubemapFiles(e.target.files)}
                        className="hidden"
                    />
                </div>

                {/* Cubemap drag-and-drop zone */}
                <div
                    onDrop={handleCubemapDrop}
                    onDragOver={(e) => { e.preventDefault(); setIsCubemapDragOver(true); }}
                    onDragLeave={() => setIsCubemapDragOver(false)}
                    onClick={() => cubemapInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-6 cursor-pointer transition-colors mb-4 ${
                        isCubemapDragOver
                            ? 'border-purple-400 bg-purple-900/20'
                            : 'border-gray-600 hover:border-purple-500 hover:bg-gray-800/50'
                    }`}
                >
                    <CubeTransparentIcon className="w-8 h-8 text-gray-500 mb-2" />
                    <p className="text-sm text-gray-400">
                        Drag & drop cubemap ZIP here, or <span className="text-indigo-400 underline">click to browse</span>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">ZIP with px/nx/py/ny/pz/nz.png</p>
                </div>

                {/* Cubemap Gallery */}
                {cubemaps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-600">
                        <CubeTransparentIcon className="w-10 h-10 mb-2 opacity-40" />
                        <p className="text-sm">No custom cubemaps yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {cubemaps.map((cube) => (
                            <div
                                key={cube.id}
                                className="relative group flex flex-col bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors"
                            >
                                <div className="w-full aspect-square bg-gray-900 flex items-center justify-center">
                                    <CubeTransparentIcon className="w-10 h-10 text-gray-600" />
                                </div>
                                <div className="p-2 flex flex-col space-y-1">
                                    <p className="text-xs text-gray-300 font-medium truncate" title={cube.name}>{cube.name}</p>
                                    <p className="text-xs text-gray-500">{formatCubemapBytes(cube.size)}</p>
                                </div>
                                {deleteConfirmCubemapId === cube.id ? (
                                    <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center space-y-2 p-2">
                                        <p className="text-xs text-red-300 text-center">Delete cubemap?</p>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteCubemap(cube.id); }}
                                                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
                                            >Delete</button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmCubemapId(null); }}
                                                className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded"
                                            >Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmCubemapId(cube.id); }}
                                        className="absolute top-1 right-1 p-1 bg-gray-900/70 hover:bg-red-900/80 text-gray-400 hover:text-red-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete cubemap"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {previewItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setPreviewItem(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] w-full bg-gray-900 rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-700">
                            <h3 className="text-lg font-semibold text-white">
                                {previewItem.type === 'image' && previewItem.item.name}
                                {previewItem.type === 'video' && previewItem.item.name}
                                {previewItem.type === 'cubemap' && previewItem.item.name}
                            </h3>
                            <button
                                onClick={() => setPreviewItem(null)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 flex items-center justify-center bg-gray-950 min-h-[300px]">
                            {previewItem.type === 'image' && (
                                <img
                                    src={previewItem.url}
                                    alt={previewItem.item.name}
                                    className="max-w-full max-h-[70vh] object-contain rounded"
                                />
                            )}
                            {previewItem.type === 'video' && (
                                <video
                                    src={previewItem.url}
                                    controls
                                    autoPlay
                                    className="max-w-full max-h-[70vh] rounded"
                                />
                            )}
                            {previewItem.type === 'cubemap' && (
                                <div className="grid grid-cols-3 gap-2 max-w-2xl">
                                    <div className="aspect-square bg-gray-800 rounded flex items-center justify-center">
                                        <span className="text-xs text-gray-500">Right (+X)</span>
                                    </div>
                                    <div className="aspect-square bg-gray-800 rounded flex items-center justify-center">
                                        <span className="text-xs text-gray-500">Left (-X)</span>
                                    </div>
                                    <div className="aspect-square bg-gray-800 rounded flex items-center justify-center">
                                        <span className="text-xs text-gray-500">Top (+Y)</span>
                                    </div>
                                    <div className="aspect-square bg-gray-800 rounded flex items-center justify-center">
                                        <span className="text-xs text-gray-500">Bottom (-Y)</span>
                                    </div>
                                    <div className="aspect-square bg-gray-800 rounded flex items-center justify-center">
                                        <span className="text-xs text-gray-500">Front (+Z)</span>
                                    </div>
                                    <div className="aspect-square bg-gray-800 rounded flex items-center justify-center">
                                        <span className="text-xs text-gray-500">Back (-Z)</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-700">
                            <p className="text-sm text-gray-400">
                                {previewItem.type === 'image' && `${formatBytes(previewItem.item.size)}`}
                                {previewItem.type === 'video' && `${formatVideoBytes(previewItem.item.size)}`}
                                {previewItem.type === 'cubemap' && `${formatCubemapBytes(previewItem.item.size)} • 6 faces`}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
