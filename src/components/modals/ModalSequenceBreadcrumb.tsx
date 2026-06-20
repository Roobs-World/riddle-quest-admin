import React from "react";
import type {ModalSequenceProgress} from "../../types/ModalTypes";
import {t} from "../../i18n";
import StepBreadcrumb from "../shared/StepBreadcrumb";

interface ModalSequenceBreadcrumbProps {
  sequenceProgress?: ModalSequenceProgress;
}

const ModalSequenceBreadcrumb: React.FC<ModalSequenceBreadcrumbProps> = ({sequenceProgress}) => {
  if (!sequenceProgress || sequenceProgress.totalPopups <= 1) {
    return null;
  }

  const total = sequenceProgress.totalPopups;
  const current = Math.min(Math.max(1, sequenceProgress.currentPopupIndex), total);

  return (
    <StepBreadcrumb
      current={current}
      total={total}
      accessibilityLabel={t("Accessibility.MODAL_SEQUENCE_PROGRESS", {current, total})}
      testID="modal-sequence-breadcrumb"
      dotTestIDPrefix="modal-sequence-breadcrumb-dot"
      getStepAccessibilityLabel={(popupIndex, popupTotal) =>
        t("Accessibility.MODAL_SEQUENCE_GO_TO_POPUP", {popupIndex, total: popupTotal})
      }
      stepAccessibilityHint={t("Accessibility.MODAL_SEQUENCE_GO_TO_HINT")}
      onSelectStep={sequenceProgress.onSelectPopup}
    />
  );
};

export default ModalSequenceBreadcrumb;
