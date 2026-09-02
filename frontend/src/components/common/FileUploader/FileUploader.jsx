import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import './FileUploader.css';

const FileUploader = ({
  onChange,
  value,
  label = 'Upload Diagnostic Findings',
  subtitle = 'Drag & drop PDF, JPG, PNG files or click to browse',
  accept = '.pdf,.jpg,.jpeg,.png',
  disabled = false,
  error
}) => {
  const fileInputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onChange(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (!disabled && e.dataTransfer.files && e.dataTransfer.files[0]) {
      onChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="file-uploader">
      <div
        className={`file-uploader-dropzone ${isDragActive ? 'drag-active' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={accept}
          disabled={disabled}
          className="visually-hidden"
          tabIndex={-1}
        />
        <Upload size={32} className="file-uploader-icon" />
        <span className="file-uploader-title">{label}</span>
        <span className="file-uploader-subtitle">
          {value ? (
            <span className="file-uploader-selected">Selected file: {value.name}</span>
          ) : (
            subtitle
          )}
        </span>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

export default FileUploader;
