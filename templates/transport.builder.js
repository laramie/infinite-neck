export class TransportBuilder {
    //static span_transport = null; //Singleton.

    static PARK_BOTTOM_CENTER = 'bottom-center';
    static PARK_TOP_RIGHT = 'top-right';
    static PARK_TOP_RIGHT_INSET_PX = 100;

    static getViewportSize() {
        return {
            width: $(window).width(),
            height: $(window).height()
        };
    }

    static getNumericCss($element, propertyName) {
        var value = parseFloat($element.css(propertyName));
        return Number.isNaN(value) ? null : value;
    }

    static measureTransport($transport) {
        var element = $transport.get(0);
        var wasVisible = $transport.is(':visible');
        var previousDisplay = element.style.display;
        var previousVisibility = element.style.visibility;

        if (!wasVisible) {
            element.style.visibility = 'hidden';
            element.style.display = 'inline-block';
        }

        var size = {
            width: $transport.outerWidth() || 0,
            height: $transport.outerHeight() || 0
        };

        if (!wasVisible) {
            element.style.display = previousDisplay;
            element.style.visibility = previousVisibility;
        }

        return size;
    }

    static getTransportRect($transport) {
        var viewport = TransportBuilder.getViewportSize();
        var size = TransportBuilder.measureTransport($transport);
        var left = TransportBuilder.getNumericCss($transport, 'left');
        var top = TransportBuilder.getNumericCss($transport, 'top');

        if (left === null || top === null) {
            var offset = $transport.offset();
            if (offset) {
                if (left === null) {
                    left = offset.left;
                }
                if (top === null) {
                    top = offset.top;
                }
            }
        }

        if (left === null) {
            left = (viewport.width / 2) - (size.width / 2);
        }
        if (top === null) {
            top = viewport.height - size.height;
        }

        return {
            left: left,
            top: top,
            width: size.width,
            height: size.height,
            bottom: top + size.height
        };
    }

    static clampPosition(left, top, width, height) {
        var viewport = TransportBuilder.getViewportSize();
        var maxLeft = Math.max(0, viewport.width - width);
        var maxTop = Math.max(0, viewport.height - height);

        return {
            left: Math.min(Math.max(left, 0), maxLeft),
            top: Math.min(Math.max(top, 0), maxTop)
        };
    }

    static applyPosition($transport, position) {
        $transport.css({
            left: position.left + 'px',
            top: position.top + 'px'
        });
    }

    static getDrawerSession($transport) {
        return $transport.data('drawer-session') || null;
    }

    static setDrawerSession($transport, session) {
        if (session) {
            $transport.data('drawer-session', session);
        } else {
            $transport.removeData('drawer-session');
        }
    }

    static positionsMatch(positionA, positionB, tolerance = 1) {
        if (!positionA || !positionB) {
            return false;
        }

        return Math.abs(positionA.left - positionB.left) <= tolerance
            && Math.abs(positionA.top - positionB.top) <= tolerance;
    }

    static setDrawerButtonState(drawerIsVisible) {
        if (drawerIsVisible) {
            $('#btnEditSection').addClass('BtnPunchedIn').removeClass('BtnPunchedOut');
        } else {
            $('#btnEditSection').addClass('BtnPunchedOut').removeClass('BtnPunchedIn');
        }
    }

    static expandDrawer($transport, $drawer) {
        var collapsedRect = TransportBuilder.getTransportRect($transport);
        var collapsedBottom = collapsedRect.bottom;
        var collapsedLeft = collapsedRect.left;

        $drawer.show();
        var expandedSize = TransportBuilder.measureTransport($transport);
        var expandedPosition = TransportBuilder.clampPosition(
            collapsedLeft,
            collapsedBottom - expandedSize.height,
            expandedSize.width,
            expandedSize.height
        );

        TransportBuilder.setDrawerSession($transport, {
            preferredCollapsedPosition: {
                left: collapsedRect.left,
                top: collapsedRect.top
            },
            autoExpandedPosition: {
                left: expandedPosition.left,
                top: expandedPosition.top
            }
        });

        TransportBuilder.applyPosition($transport, expandedPosition);
    }

    static collapseDrawer($transport, $drawer) {
        var expandedRect = TransportBuilder.getTransportRect($transport);
        var expandedPosition = {
            left: expandedRect.left,
            top: expandedRect.top
        };
        var drawerSession = TransportBuilder.getDrawerSession($transport);

        $drawer.hide();
        var collapsedSize = TransportBuilder.measureTransport($transport);

        var collapsedPosition;
        if (drawerSession && TransportBuilder.positionsMatch(expandedPosition, drawerSession.autoExpandedPosition)) {
            collapsedPosition = TransportBuilder.clampPosition(
                drawerSession.preferredCollapsedPosition.left,
                drawerSession.preferredCollapsedPosition.top,
                collapsedSize.width,
                collapsedSize.height
            );
        } else {
            collapsedPosition = TransportBuilder.clampPosition(
                expandedRect.left,
                expandedRect.bottom - collapsedSize.height,
                collapsedSize.width,
                collapsedSize.height
            );
        }

        TransportBuilder.applyPosition($transport, collapsedPosition);
        TransportBuilder.setDrawerSession($transport, null);
    }


    static showTransport(parkMode = false) {
		var $transport = $('#transport');
		$transport.show();
        if (parkMode === TransportBuilder.PARK_TOP_RIGHT) {
            TransportBuilder.hideSectionDrawer();
        }
        TransportBuilder.transportResize(parkMode);
	}
	static toggleTransport(){
		var $transport = $('#transport');

		if ($transport.is(':visible')) {
			$transport.hide();
			return;
		}

		$transport.show();
		TransportBuilder.transportResize();
	}
	static hideTransport(){
		var $transport = $('#transport');
        $transport.hide();
	}

    static transportResize(parkMode = false) {
        var $transport = $('#transport');
        var $drawer = $('#spanSectionDrawer');
        var rect = TransportBuilder.getTransportRect($transport);
        var left = rect.left;
        var top = rect.top;
        var viewport;

        if (parkMode === true || parkMode === TransportBuilder.PARK_BOTTOM_CENTER) {
            viewport = TransportBuilder.getViewportSize();
            left = (viewport.width / 2) - (rect.width / 2);
            top = viewport.height - rect.height;
        } else if (parkMode === TransportBuilder.PARK_TOP_RIGHT) {
            viewport = TransportBuilder.getViewportSize();
            left = viewport.width - rect.width - TransportBuilder.PARK_TOP_RIGHT_INSET_PX;
            top = 0;
        }

        var clampedPosition = TransportBuilder.clampPosition(left, top, rect.width, rect.height);

        TransportBuilder.applyPosition($transport, clampedPosition);

        if ($drawer.is(':visible')) {
            var drawerSession = TransportBuilder.getDrawerSession($transport);
            if (drawerSession) {
                drawerSession.autoExpandedPosition = {
                    left: clampedPosition.left,
                    top: clampedPosition.top
                };
                TransportBuilder.setDrawerSession($transport, drawerSession);
            }
        }
    }

    static toggleSectionDrawer(forceShow = false) {
        var $transport = $('#transport');
        var $drawer = $('#spanSectionDrawer');
        var transportWasVisible = $transport.is(':visible');
        var drawerWasVisible = $drawer.is(':visible');

        if (!transportWasVisible) {
            $transport.show();
        }

        if (forceShow && drawerWasVisible) {
            TransportBuilder.transportResize();
        } else if (forceShow || !drawerWasVisible) {
            TransportBuilder.expandDrawer($transport, $drawer);
        } else {
            TransportBuilder.collapseDrawer($transport, $drawer);
        }

        var drawerIsVisible = $drawer.is(':visible');
        TransportBuilder.setDrawerButtonState(drawerIsVisible);
        TransportBuilder.transportResize();
    }

    static hideSectionDrawer() {
        var $transport = $('#transport');
        var $drawer = $('#spanSectionDrawer');

        if (!$drawer.is(':visible')) {
            TransportBuilder.setDrawerButtonState(false);
            if ($transport.is(':visible')) {
                TransportBuilder.transportResize();
            }
            return;
        }

        if (!$transport.is(':visible')) {
            $drawer.hide();
            TransportBuilder.setDrawerButtonState(false);
            return;
        }

        TransportBuilder.collapseDrawer($transport, $drawer);
        TransportBuilder.setDrawerButtonState(false);
        TransportBuilder.transportResize();
    }
}