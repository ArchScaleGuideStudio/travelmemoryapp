/**
 * Capture adapter.
 *
 * Defines `pickPhotos()` and `takePhoto()` that return File objects regardless
 * of platform. On native, uses @capacitor/camera. On web, uses an <input type=file>.
 *
 * This is the pattern that lets the same PhotoUploader work everywhere:
 *   const files = await capture.pickPhotos({ multiple: true })
 *   await Promise.all(files.map((f) => MediaService.upload(...)))
 */

import { isNative } from './platform'

export interface CaptureAdapter {
  pickPhotos(opts?: { multiple?: boolean }): Promise<File[]>
  takePhoto(): Promise<File | null>
  /** Permissions on native; on web returns 'granted' since file input doesn't need permission */
  ensurePermission(): Promise<'granted' | 'denied' | 'prompt'>
}

class WebCapture implements CaptureAdapter {
  async pickPhotos({ multiple = true } = {}): Promise<File[]> {
    return new Promise<File[]>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*,video/*'
      input.multiple = multiple
      input.onchange = () => {
        const files = input.files ? Array.from(input.files) : []
        resolve(files)
      }
      // If user cancels, onchange never fires — best-effort cleanup
      input.click()
    })
  }

  async takePhoto(): Promise<File | null> {
    // On web, browser camera capture via input[capture]
    return new Promise<File | null>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.setAttribute('capture', 'environment')
      input.onchange = () => {
        const file = input.files?.[0] ?? null
        resolve(file)
      }
      input.click()
    })
  }

  async ensurePermission() { return 'granted' as const }
}

class NativeCapture implements CaptureAdapter {
  async pickPhotos({ multiple = true } = {}): Promise<File[]> {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    if (multiple) {
      const result = await Camera.pickImages({
        quality: 92,
        limit: 50,
        presentationStyle: 'fullscreen',
      })
      const files: File[] = []
      for (const photo of result.photos) {
        const blob = await (await fetch(photo.webPath ?? photo.path ?? '')).blob()
        const ext = photo.format ?? 'jpg'
        files.push(new File([blob], `photo.${ext}`, { type: blob.type || `image/${ext}` }))
      }
      return files
    } else {
      const photo = await Camera.getPhoto({
        quality: 92,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
      })
      if (!photo.webPath) return []
      const blob = await (await fetch(photo.webPath)).blob()
      const ext = photo.format ?? 'jpg'
      return [new File([blob], `photo.${ext}`, { type: blob.type || `image/${ext}` })]
    }
  }

  async takePhoto(): Promise<File | null> {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    try {
      const photo = await Camera.getPhoto({
        quality: 92,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        saveToGallery: true,
      })
      if (!photo.webPath) return null
      const blob = await (await fetch(photo.webPath)).blob()
      const ext = photo.format ?? 'jpg'
      return new File([blob], `photo.${ext}`, { type: blob.type || `image/${ext}` })
    } catch (err) {
      // User cancelled or permission denied
      return null
    }
  }

  async ensurePermission(): Promise<'granted' | 'denied' | 'prompt'> {
    const { Camera } = await import('@capacitor/camera')
    const result = await Camera.checkPermissions()
    if (result.camera === 'granted' && result.photos === 'granted') return 'granted'
    if (result.camera === 'denied'  || result.photos === 'denied')  return 'denied'
    // Request
    const req = await Camera.requestPermissions({ permissions: ['camera', 'photos'] })
    return req.camera === 'granted' ? 'granted' : 'denied'
  }
}

export const capture: CaptureAdapter = isNative() ? new NativeCapture() : new WebCapture()
