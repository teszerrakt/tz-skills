// The Linux card: toast.ps1's design in QML, pinned to the bottom-right corner by layer-shell-qt.
// Run by toast-card.ts, which passes the spec as the last argument and reads the answer from the log.
import QtQuick
import QtQuick.Effects
import QtQuick.Window
import org.kde.layershell as LayerShell

Window {
    id: root

    readonly property var spec: JSON.parse(Qt.application.arguments[Qt.application.arguments.length - 1])
    readonly property bool isQuestion: spec.kind === "question"
    readonly property bool isSmall: spec.kind === "good" || spec.kind === "waiting"
    readonly property color signalColor: ({ question: "#F5A623", waiting: "#F5A623", stop: "#FF6166", good: "#45D483" })[spec.kind] || "#8F8F8F"

    // Room around the card for its shadow; the shadow room also keeps the card off the screen's edge.
    readonly property int shadowRoom: 18
    readonly property int cardWidth: 416

    readonly property string sans: "Geist, Inter, Noto Sans"
    readonly property string mono: "Geist Mono, JetBrains Mono, monospace"
    readonly property color textColor: "#EDEDED"
    readonly property color mutedColor: "#8F8F8F"
    readonly property color bodyColor: "#A1A1A1"
    readonly property color lineColor: "#2A2A2A"
    readonly property color linkColor: "#52A8FF"

    property bool finished: false

    // Each answer line goes to the log behind a marker the wrapper looks for; QML cannot write to stdout.
    function finish(...lines) {
        if (finished)
            return
        finished = true
        for (const line of lines)
            console.log("ship-ui-answer: " + line)
        Qt.quit()
    }

    function answer(choice) {
        const typed = freeText.text.trim().replace(/\s+/g, " ")
        const lines = []
        if (choice)
            lines.push("choice: " + choice)
        if (typed)
            lines.push("text: " + typed)
        if (lines.length)
            finish(...lines)
    }

    width: cardWidth + 2 * shadowRoom
    height: card.height + 2 * shadowRoom
    color: "transparent"
    flags: Qt.FramelessWindowHint
    visible: true

    LayerShell.Window.scope: "ship-ui-toast"
    LayerShell.Window.layer: LayerShell.Window.LayerTop
    LayerShell.Window.anchors: LayerShell.Window.AnchorBottom | LayerShell.Window.AnchorRight
    LayerShell.Window.exclusionZone: -1
    // Keys reach the card only once clicked, so it never takes focus from what the user is typing.
    LayerShell.Window.keyboardInteractivity: LayerShell.Window.KeyboardInteractivityOnDemand

    Timer {
        interval: (root.spec.seconds || (root.isSmall ? 8 : 300)) * 1000
        running: true
        onTriggered: root.finish("timeout")
    }

    MultiEffect {
        source: card
        anchors.fill: card
        shadowEnabled: true
        shadowColor: "#000000"
        shadowOpacity: 0.55
        shadowBlur: 1.0
        shadowVerticalOffset: 8
    }

    Rectangle {
        id: card

        x: root.shadowRoom
        y: root.shadowRoom
        width: root.cardWidth
        height: content.height + (signalLine.visible ? signalLine.height : 0)
        radius: 12
        color: "#0A0A0A"
        border.color: root.lineColor

        focus: true
        Keys.onPressed: (event) => {
            if (event.key === Qt.Key_Escape) {
                root.finish("later")
                event.accepted = true
                return
            }
            // 1 to 9 picks an option, as on the Windows card.
            const pick = event.key - Qt.Key_1
            if (!freeText.activeFocus && pick >= 0 && pick < optionList.count) {
                root.answer(root.spec.options[pick].label)
                event.accepted = true
            }
        }

        Rectangle {
            id: signalLine
            visible: !root.isSmall
            x: 12
            width: parent.width - 24
            height: 2
            radius: 1
            color: root.signalColor
        }

        Column {
            id: content

            y: signalLine.visible ? signalLine.height : 0
            x: 18
            width: parent.width - 36
            topPadding: 14
            bottomPadding: 16

            // Head: icon, ticket, state, then the time and the hide button on the right.
            Item {
                width: parent.width
                height: 28

                Row {
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: 8

                    SignalIcon {
                        anchors.verticalCenter: parent.verticalCenter
                        kind: root.spec.kind
                        color: root.signalColor
                    }
                    Text { text: root.spec.tag || ""; font.family: root.mono; font.pixelSize: 12; color: root.textColor }
                    Text { text: root.spec.state || ""; font.family: root.mono; font.pixelSize: 12; color: root.mutedColor }
                }

                Row {
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: 6

                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        text: root.spec.time || ""
                        font.family: root.mono
                        font.pixelSize: 12
                        color: root.mutedColor
                    }
                    CardButton {
                        visible: !root.isSmall
                        label: "✕"
                        width: 28
                        height: 28
                        fill: "transparent"
                        edge: "transparent"
                        ink: root.mutedColor
                        onClicked: root.finish("later")
                    }
                }
            }

            Text {
                width: parent.width
                topPadding: root.isSmall ? 8 : 12
                text: root.spec.title || ""
                wrapMode: Text.Wrap
                font.family: root.sans
                font.pixelSize: root.isSmall ? 14 : 17
                font.weight: Font.DemiBold
                lineHeight: 1.25
                color: root.textColor
            }

            Text {
                visible: !!root.spec.body
                width: parent.width
                topPadding: 6
                text: root.spec.body || ""
                wrapMode: Text.Wrap
                font.family: root.sans
                font.pixelSize: 14
                lineHeight: 1.3
                color: root.bodyColor
            }

            // A question: one button per option, then a field for an answer of the user's own.
            Column {
                visible: root.isQuestion
                width: parent.width
                topPadding: 6
                spacing: 6

                Repeater {
                    id: optionList

                    model: root.isQuestion ? root.spec.options : []

                    OptionButton {
                        required property var modelData
                        required property int index

                        width: parent.width
                        number: index + 1
                        label: modelData.label
                        detail: modelData.detail || ""
                        recommended: index === root.spec.recommended
                        onClicked: root.answer(modelData.label)
                    }
                }

                Row {
                    width: parent.width
                    topPadding: 2
                    spacing: 6

                    Rectangle {
                        width: parent.width - sendButton.width - parent.spacing
                        height: 40
                        radius: 6
                        color: "#000000"
                        border.color: freeText.activeFocus ? root.linkColor : root.lineColor

                        TextInput {
                            id: freeText

                            anchors.fill: parent
                            anchors.leftMargin: 12
                            anchors.rightMargin: 12
                            verticalAlignment: TextInput.AlignVCenter
                            clip: true
                            font.family: root.sans
                            font.pixelSize: 14
                            color: root.textColor
                            onAccepted: root.answer("")

                            Text {
                                visible: !freeText.text
                                anchors.verticalCenter: parent.verticalCenter
                                text: "Or type your own answer"
                                font: freeText.font
                                color: root.mutedColor
                            }
                        }
                    }

                    CardButton {
                        id: sendButton
                        label: "Send"
                        primary: true
                        onClicked: root.answer("")
                    }
                }
            }

            Text {
                visible: !!root.spec.because
                width: parent.width
                topPadding: 12
                text: "Asked because: " + (root.spec.because || "")
                wrapMode: Text.Wrap
                font.family: root.sans
                font.pixelSize: 13
                lineHeight: 1.3
                color: root.mutedColor
            }

            // An event: open the page, or put it off.
            Row {
                visible: !root.isQuestion
                topPadding: 14
                spacing: 6

                CardButton {
                    label: root.spec.action || "Open"
                    primary: true
                    onClicked: root.finish("open")
                }
                CardButton {
                    visible: !root.isSmall
                    label: "Later"
                    onClicked: root.finish("later")
                }
            }

            // A question's footer: the link to the page, and how many more wait.
            Item {
                visible: root.isQuestion
                width: parent.width
                height: 38

                Rectangle { width: parent.width; height: 1; y: 14; color: root.lineColor }

                Text {
                    y: 24
                    text: "Open in command center"
                    font.family: root.sans
                    font.pixelSize: 13
                    font.underline: openLink.containsMouse
                    color: root.linkColor

                    MouseArea {
                        id: openLink
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.finish("open")
                    }
                }

                Text {
                    visible: root.spec.more > 0
                    anchors.right: parent.right
                    y: 24
                    text: root.spec.more + " more waiting"
                    font.family: root.mono
                    font.pixelSize: 12
                    color: root.mutedColor
                }
            }
        }
    }

    component CardButton: Rectangle {
        id: button

        property string label
        property bool primary: false
        property color fill: primary ? root.textColor : "transparent"
        property color edge: primary ? root.textColor : root.lineColor
        property color ink: primary ? "#0A0A0A" : root.textColor
        signal clicked

        width: buttonText.implicitWidth + 28
        height: 40
        radius: 6
        color: fill
        border.color: edge
        opacity: buttonArea.containsMouse ? 0.82 : 1

        Text {
            id: buttonText
            anchors.centerIn: parent
            text: button.label
            font.family: root.sans
            font.pixelSize: 14
            font.weight: button.primary ? Font.DemiBold : Font.Normal
            color: button.ink
        }

        MouseArea {
            id: buttonArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: button.clicked()
        }
    }

    component OptionButton: Rectangle {
        id: option

        property int number
        property string label
        property string detail
        property bool recommended
        signal clicked

        height: Math.max(42, optionText.height + 16)
        radius: 6
        color: optionArea.containsMouse ? "#1A1A1A" : "#111111"
        border.color: optionArea.containsMouse || recommended ? root.textColor : root.lineColor

        Rectangle {
            id: key
            x: 12
            anchors.verticalCenter: parent.verticalCenter
            width: keyText.implicitWidth + 12
            height: keyText.implicitHeight + 2
            radius: 4
            color: "transparent"
            border.color: root.lineColor

            Text {
                id: keyText
                anchors.centerIn: parent
                text: option.number
                font.family: root.mono
                font.pixelSize: 11
                color: root.mutedColor
            }
        }

        Column {
            id: optionText
            anchors.left: key.right
            anchors.leftMargin: 10
            anchors.right: pick.visible ? pick.left : parent.right
            anchors.rightMargin: pick.visible ? 10 : 12
            anchors.verticalCenter: parent.verticalCenter
            spacing: 2

            Text {
                width: parent.width
                text: option.label
                wrapMode: Text.Wrap
                font.family: root.sans
                font.pixelSize: 14
                font.weight: Font.Medium
                color: root.textColor
            }
            Text {
                visible: !!option.detail
                width: parent.width
                text: option.detail
                wrapMode: Text.Wrap
                font.family: root.sans
                font.pixelSize: 13
                color: root.bodyColor
            }
        }

        Rectangle {
            id: pick
            visible: option.recommended
            anchors.right: parent.right
            anchors.rightMargin: 12
            anchors.verticalCenter: parent.verticalCenter
            width: pickText.implicitWidth + 18
            height: pickText.implicitHeight + 5
            radius: 9
            color: "#0A1F38"

            Text {
                id: pickText
                anchors.centerIn: parent
                text: "Recommended"
                font.family: root.sans
                font.pixelSize: 11
                font.weight: Font.DemiBold
                color: root.linkColor
            }
        }

        MouseArea {
            id: optionArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: option.clicked()
        }
    }

    // The same 24-unit shapes toast.ps1 draws: a ring with "?" or a check, or a warning triangle.
    component SignalIcon: Canvas {
        property string kind
        property color color

        width: 16
        height: 16
        onPaint: {
            const ctx = getContext("2d")
            ctx.reset()
            ctx.scale(width / 24, height / 24)
            ctx.strokeStyle = color
            ctx.lineWidth = 1.7
            ctx.lineCap = "round"
            ctx.lineJoin = "round"
            ctx.beginPath()
            if (kind === "stop") {
                ctx.moveTo(12, 4); ctx.lineTo(21, 20); ctx.lineTo(3, 20); ctx.closePath()
                ctx.moveTo(12, 10); ctx.lineTo(12, 14)
                ctx.moveTo(12, 17); ctx.lineTo(12.01, 17)
            } else {
                ctx.arc(12, 12, 9, 0, 2 * Math.PI)
                if (kind === "good") {
                    ctx.moveTo(8, 12.5); ctx.lineTo(10.5, 15); ctx.lineTo(16, 9.5)
                } else {
                    ctx.moveTo(9.5, 9.5)
                    ctx.arc(12, 9.5, 2.5, Math.PI, 2.3 * Math.PI)
                    ctx.lineTo(12, 13.5)
                    ctx.moveTo(12, 17); ctx.lineTo(12.01, 17)
                }
            }
            ctx.stroke()
        }
    }
}
