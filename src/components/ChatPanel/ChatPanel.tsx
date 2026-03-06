import React, { useMemo } from "react";
import _ from "lodash";
import VerticalText from "../UI/VerticalText";
import dayjs from "dayjs";
import { relativeDate } from "@/lib/time";
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
};
const ChatPanel: React.FC<ChatPanelProps> = ({ messages }) => {
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
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          overflowY: "auto",
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
      </div>
    </div>
  );
};

export default ChatPanel;
