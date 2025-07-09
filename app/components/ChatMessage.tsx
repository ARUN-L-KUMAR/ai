function parseMarkdown(text: string): string {
  // Step 1: Normalize all bullet types to • and fix heading issues with emojis
  const normalized = text
    .replace(/^(#{1,6})(\s*)([\u{1F300}-\u{1F6FF}])/gu, (_match, hashes, space, emoji) => `${hashes} ${emoji}`)
    .replace(/^\s*[-*+](\s|$)/gm, '• ')  // Handle -, *, + bullets
    .replace(/^\s*•(\s|$)/gm, '• ');

  const lines = normalized.split('\n');
  const result: string[] = [];
  let currentList: string[] = [];
  let inList = false;
  let currentListType: 'ul' | 'ol' = 'ul';

  const isBulletPoint = (line: string): boolean => {
    const trimmed = line.trim();
    if (trimmed.startsWith('• ')) return true;
    if (/^\d+\.\s/.test(trimmed)) return true;
    const emojiPattern = /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]\s/u;
    return emojiPattern.test(trimmed);
  };

  const extractBulletContent = (line: string): string => {
    const trimmed = line.trim();
    if (trimmed.startsWith('• ')) return trimmed.substring(2);
    const numberedMatch = trimmed.match(/^\d+\.\s(.*)$/);
    if (numberedMatch) return numberedMatch[1];
    const emojiMatch = trimmed.match(/^([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s(.*)$/u);
    if (emojiMatch) return emojiMatch[2];
    return trimmed;
  };

  const processInlineMarkdown = (text: string): string => {
    return text
      .replace(/\*\*\*\*(.*?)\*\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
      .replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded">$1</code>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto">');
  };

  const getListType = (line: string): 'ul' | 'ol' => {
    return /^\d+\.\s/.test(line.trim()) ? 'ol' : 'ul';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isBulletPoint(trimmed)) {
      const content = extractBulletContent(trimmed);
      const listType = getListType(trimmed);

      if (inList && currentListType !== listType && currentList.length > 0) {
        const listClass = currentListType === 'ol' ? 'list-decimal pl-5 space-y-1 mb-4' : 'list-disc pl-5 space-y-1 mb-4';
        result.push(`<${currentListType} class="${listClass}">${currentList.join('')}</${currentListType}>`);
        currentList = [];
      }

      currentListType = listType;
      const processedContent = processInlineMarkdown(content);
      currentList.push(`<li>${processedContent}</li>`);
      inList = true;
    } else {
      if (inList && currentList.length > 0) {
        const listClass = currentListType === 'ol' ? 'list-decimal pl-5 space-y-1 mb-4' : 'list-disc pl-5 space-y-1 mb-4';
        result.push(`<${currentListType} class="${listClass}">${currentList.join('')}</${currentListType}>`);
        currentList = [];
        inList = false;
      }

      if (trimmed) {
        if (/^#{6}\s+.+/.test(trimmed)) {
          result.push(`<h6 class="text-xs font-bold mt-2 mb-1">${processInlineMarkdown(trimmed.substring(7).trim())}</h6>`);
        } else if (/^#{5}\s+.+/.test(trimmed)) {
          result.push(`<h5 class="text-xs font-bold mt-2 mb-1">${processInlineMarkdown(trimmed.substring(6).trim())}</h5>`);
        } else if (/^#{4}\s+.+/.test(trimmed)) {
          result.push(`<h4 class="text-sm font-bold mt-3 mb-1">${processInlineMarkdown(trimmed.substring(5).trim())}</h4>`);
        } else if (/^#{3}\s+.+/.test(trimmed)) {
          result.push(`<h3 class="text-md font-bold mt-4 mb-2">${processInlineMarkdown(trimmed.substring(4).trim())}</h3>`);
        } else if (/^#{2}\s+.+/.test(trimmed)) {
          result.push(`<h2 class="text-lg font-bold mt-5 mb-3">${processInlineMarkdown(trimmed.substring(3).trim())}</h2>`);
        } else if (/^#{1}\s+.+/.test(trimmed)) {
          result.push(`<h1 class="text-xl font-bold mt-6 mb-4">${processInlineMarkdown(trimmed.substring(2).trim())}</h1>`);
        } else if (["---", "***", "___"].includes(trimmed)) {
          result.push('<hr class="my-4 border-gray-300">');
        } else if (trimmed.startsWith('> ')) {
          result.push(`<blockquote class="border-l-4 border-gray-300 pl-4 italic mb-4">${processInlineMarkdown(trimmed.substring(2))}</blockquote>`);
        } else if (trimmed.startsWith('```')) {
          const codeLines = [trimmed];
          let j = i + 1;
          while (j < lines.length && !lines[j].trim().startsWith('```')) {
            codeLines.push(lines[j]);
            j++;
          }
          if (j < lines.length) codeLines.push(lines[j]);
          const language = trimmed.substring(3).trim();
          const codeContent = codeLines.slice(1, -1).join('\n');
          result.push(`<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4"><code class="language-${language}">${codeContent}</code></pre>`);
          i = j;
        } else {
          result.push(`<p class="mb-2">${processInlineMarkdown(trimmed)}</p>`);
        }
      } else {
        if (result.length > 0 && !result[result.length - 1].includes('mb-')) {
          result.push('<div class="mb-4"></div>');
        }
      }
    }
  }

  if (inList && currentList.length > 0) {
    const listClass = currentListType === 'ol' ? 'list-decimal pl-5 space-y-1 mb-4' : 'list-disc pl-5 space-y-1 mb-4';
    result.push(`<${currentListType} class="${listClass}">${currentList.join('')}</${currentListType}>`);
  }

  return result.join('');
}



// Updated ChatMessage component
interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
  };
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-3xl px-4 py-2 rounded-lg ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div
            dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
          />
        )}
      </div>
    </div>
  );
}