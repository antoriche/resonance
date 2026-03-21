import React, {
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
} from "react";
import _ from "lodash";
import VerticalText from "../UI/VerticalText";
import dayjs from "dayjs";
import { relativeDate } from "@/lib/shared/time";
import Avatar from "../Avatar/Avatar";

type ChatPanelProps = {
  messages: Array<{
    datetime: Date;
    speaker: {
      id: string;
      name?: string;
      color?: string;
      gender: "male" | "female" | "other";
    };
    text: string;
  }>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onScrollPositionChange?: (isAtBottom: boolean) => void;
};
const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onScrollPositionChange,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const savedScrollTopRef = useRef(0);
  const isLoadingRef = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Debounced callback for scroll position changes
  const debouncedScrollPositionChange = useCallback(
    _.debounce((isAtBottom: boolean) => {
      onScrollPositionChange?.(isAtBottom);
    }, 300),
    [onScrollPositionChange],
  );

  // Restore scroll position BEFORE the browser paints
  // With column-reverse, content position relative to the bottom doesn't change
  // when older messages are added at the visual top — so restoring the same
  // scrollTop value keeps the viewport on the same messages.
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (
      messages.length > lastMessageCountRef.current &&
      lastMessageCountRef.current > 0 &&
      isLoadingRef.current
    ) {
      container.scrollTop = savedScrollTopRef.current;
      isLoadingRef.current = false;
    }

    lastMessageCountRef.current = messages.length;
  }, [messages]);

  // Handle scroll to load more when reaching the top (older messages with column-reverse)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !onLoadMore || !hasMore) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;

      const maxScroll = scrollHeight - clientHeight;
      const currentScroll = Math.abs(scrollTop);

      // Load more when within 100px of the visual top (oldest messages)
      if (
        maxScroll - currentScroll < 100 &&
        !isLoadingMore &&
        !isLoadingRef.current
      ) {
        // Save the exact scrollTop right before triggering load
        savedScrollTopRef.current = scrollTop;
        isLoadingRef.current = true;
        onLoadMore();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [onLoadMore, hasMore, isLoadingMore]);

  // Track scroll position for polling (at bottom = most recent messages with column-reverse)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScrollPosition = () => {
      const { scrollTop } = container;
      // With column-reverse, scrollTop ≈ 0 means at bottom (most recent)
      const atBottom = Math.abs(scrollTop) < 100;

      if (atBottom !== isAtBottom) {
        setIsAtBottom(atBottom);
        debouncedScrollPositionChange(atBottom);
      }
    };

    container.addEventListener("scroll", checkScrollPosition);
    // Check initial position
    checkScrollPosition();

    return () => container.removeEventListener("scroll", checkScrollPosition);
  }, [isAtBottom, debouncedScrollPositionChange]);

  // If content doesn't overflow, scroll events won't fire — auto-load more
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (
      !container ||
      !onLoadMore ||
      !hasMore ||
      isLoadingMore ||
      isLoadingRef.current
    )
      return;

    if (container.scrollHeight <= container.clientHeight) {
      onLoadMore();
    }
  }, [messages, onLoadMore, hasMore, isLoadingMore]);
  const messagesPerDay = useMemo(
    () =>
      _(messages)
        .groupBy((message) => message.datetime.toDateString())
        .map((messages, date) => {
          const sortedMessages = messages.sort(
            (a, b) => a.datetime.getTime() - b.datetime.getTime(),
          );
          const messagesWithTimeGroup: Array<
            (typeof sortedMessages)[number] & { timeGroup: Date }
          > = [];
          let timeGroup: Date = sortedMessages[0].datetime ?? new Date();
          for (const message of sortedMessages) {
            if (dayjs(message.datetime).diff(timeGroup, "minute") > 5) {
              timeGroup = message.datetime;
            }
            messagesWithTimeGroup.push({
              ...message,
              timeGroup,
            });
          }
          return {
            date: dayjs(date).toDate(),
            messages: messagesWithTimeGroup,
          };
        })
        .value(),
    [messages],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <h3>Chat Panel</h3>
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column-reverse",
          gap: 16,
          overflowY: "auto",
          overflowAnchor: "none",
        }}
      >
        {messagesPerDay.map(({ date, messages }) => (
          <div
            key={date.toISOString()}
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 16,
            }}
          >
            <VerticalText style={{ color: "#B3B3B3" }}>
              <h4 style={{ margin: 0 }}>{relativeDate(date)}</h4>
            </VerticalText>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {_(messages)
                .groupBy((message) => message.timeGroup.toISOString())
                .map((messages, timeGroup) => (
                  <div
                    key={timeGroup}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        color: "#B3B3B3",
                        fontSize: 12,
                        marginLeft: 20,
                      }}
                    >
                      {dayjs(timeGroup).format("h:mm A")}
                    </span>
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <span>
                          <Avatar
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: "50%",
                            }}
                            seed={message.speaker.id}
                            gender={message.speaker.gender}
                            color={message.speaker.color ?? "transparent"}
                          />
                        </span>
                        <span>{message.text}</span>
                      </div>
                    ))}
                  </div>
                ))
                .value()}
            </div>
          </div>
        ))}
        {isLoadingMore && (
          <div
            style={{
              padding: "1rem",
              textAlign: "center",
              color: "#B3B3B3",
              fontSize: 14,
            }}
          >
            Loading more...
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
