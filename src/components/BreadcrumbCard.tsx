import { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { BookOpen, FileText, Mic, Link as LinkIcon, Image, Video, Calendar, User, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RecipientInfo {
  id: string;
  name: string;
}

interface BreadcrumbCardProps {
  breadcrumb: {
    id: string;
    title: string;
    content_type: string;
    text_body: string | null;
    is_scripture: boolean;
    scripture_reference: string | null;
    created_at: string;
    recipient?: {
      id: string;
      display_name: string;
    };
    topic?: {
      id: string;
      name: string;
    } | null;
    creator?: {
      id: string;
      name: string;
    };
    recipient_count?: number;
    recipient_names?: string[];
    recipients_info?: RecipientInfo[];
  };
  showRecipient?: boolean;
  showCreator?: boolean;
  style?: CSSProperties;
  onRecipientClick?: (recipientId: string) => void;
}

const contentTypeIcons: Record<string, React.ReactNode> = {
  text: <FileText className="w-4 h-4 text-white" />,
  scripture: <BookOpen className="w-4 h-4 text-white" />,
  voice_note: <Mic className="w-4 h-4 text-white" />,
  document: <FileText className="w-4 h-4 text-white" />,
  link: <LinkIcon className="w-4 h-4 text-white" />,
  photo: <Image className="w-4 h-4 text-white" />,
  video: <Video className="w-4 h-4 text-white" />,
};

export function BreadcrumbCard({ breadcrumb, showRecipient, showCreator, style, onRecipientClick }: BreadcrumbCardProps) {
  const icon = breadcrumb.is_scripture 
    ? contentTypeIcons.scripture 
    : contentTypeIcons[breadcrumb.content_type] || contentTypeIcons.text;

  const preview = breadcrumb.text_body
    ? breadcrumb.text_body.substring(0, 120) + (breadcrumb.text_body.length > 120 ? "..." : "")
    : breadcrumb.scripture_reference || null;

  const isSharedWithMultiple = (breadcrumb.recipient_count ?? 1) > 1;

  return (
    <Link 
      to={`/breadcrumb/${breadcrumb.id}`}
      className="block animate-fade-up"
      style={style}
    >
      <div className="glass-card p-4 sm:p-5 hover:border-accent/50 hover:shadow-warm transition-all duration-300 group">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black flex items-center justify-center group-hover:bg-accent transition-colors">
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row - stacks on mobile */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h3 className="font-serif text-base sm:text-lg font-medium text-foreground line-clamp-2 sm:truncate">
                  {breadcrumb.title}
                </h3>
                {isSharedWithMultiple && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 cursor-help">
                          <Users className="w-3 h-3" />
                          Family
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="p-0">
                        <div className="p-2">
                          <p className="font-medium mb-1 px-1">Shared with:</p>
                          <ul className="text-xs space-y-0.5">
                            {breadcrumb.recipients_info?.map((recipient) => (
                              <li key={recipient.id}>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onRecipientClick?.(recipient.id);
                                  }}
                                  className="w-full text-left px-1 py-0.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
                                >
                                  {recipient.name}
                                </button>
                              </li>
                            )) || breadcrumb.recipient_names?.map((name, idx) => (
                              <li key={idx} className="px-1">{name}</li>
                            )) || <li className="px-1">Multiple recipients</li>}
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {breadcrumb.topic && (
                <span className="flex-shrink-0 text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground w-fit">
                  {breadcrumb.topic.name}
                </span>
              )}
            </div>

            {preview && (
              <p className="text-sm text-muted-foreground mt-1.5 sm:mt-1 line-clamp-2">
                {breadcrumb.is_scripture && breadcrumb.scripture_reference 
                  ? `📖 ${breadcrumb.scripture_reference}` 
                  : preview
                }
              </p>
            )}

            {/* Meta - wraps nicely on mobile */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 sm:mt-3 text-xs text-muted-foreground">
              {showRecipient && breadcrumb.recipient && !isSharedWithMultiple && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  For {breadcrumb.recipient.display_name}
                </span>
              )}
              {showRecipient && isSharedWithMultiple && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Shared with {breadcrumb.recipient_count}
                </span>
              )}
              {showCreator && breadcrumb.creator && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  From {breadcrumb.creator.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDistanceToNow(new Date(breadcrumb.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}