class GetDataFromGoogleSheet {
  getGeneralInformation(id, callback) {
    google.script.run.withSuccessHandler(callback).getGeneralInformation(id);
  }

  getConsultFor(id, callback) {
    google.script.run.withSuccessHandler(callback).getConsultFor(id);
  }

  getHealthInformation(id, callback) {
    google.script.run.withSuccessHandler(callback).getHealthInformation(id);
  }

  getFamilyMeeting(id, callback) {
    google.script.run.withSuccessHandler(callback).getFamilyMeeting(id);
  }

  getTreatment(id, callback) {
    google.script.run.withSuccessHandler(callback).getTreatment(id);
  }

  getEducationTraining(id, callback) {
    google.script.run.withSuccessHandler(callback).getEducationTraining(id);
  }

  getFollowUp(id, callback) {
    google.script.run.withSuccessHandler(callback).getFollowUp(id);
  }

  getHomeVisit(id, callback) {
    google.script.run.withSuccessHandler(callback).getHomeVisit(id);
  }
}

class SendFormToGoogle {
  sendGeneralInformation(from, callback) {
    console.log('sendGeneralInformation', id, from);
    // google.script.run.withSuccessHandler(callback).submitGeneralInformationForm(from);
  }

  sendConsultFor(id, from, callback) {
    console.log('sendConsultFor', id, from);
    setTimeout(callback, 3000);
    // google.script.run.withSuccessHandler(callback).submitConsultForForm(id, from);
  }

  sendHealthInformation(id, from, callback) {
    console.log('sendConsultFor', id, from);
    setTimeout(callback, 3000);
    // google.script.run.withSuccessHandler(callback).submitHealthInformationForm(id, from);
  }

  sendFamilyMeeting(id, from, callback) {
    console.log('sendFamilyMeeting', id, from);
    setTimeout(callback, 3000);
    // google.script.run.withSuccessHandler(callback).submitFamilyMeetingForm(id, from);
  }

  sendTreatment(id, from, callback) {
    console.log('sendTreatment', id, from);
    setTimeout(callback, 3000);
    // google.script.run.withSuccessHandler(callback).submitTreatmentForm(id, from);
  }

  sendEducationTraining(id, from, callback) {
    console.log('sendEducationTraining', id, from);
    setTimeout(callback, 3000);
    // google.script.run.withSuccessHandler(callback).submitEducationTrainingForm(id, from);
  }

  sendFollowUp(id, from, callback) {
    console.log('sendFollowUp', id, from);
    setTimeout(callback, 3000);
    // google.script.run.withSuccessHandler(callback).submitFollowUpForm(id, from);
  }

  sendHomeVisit(id, from, callback) {
    console.log('sendHomeVisit', id, from);
    setTimeout(callback, 3000);
    // google.script.run.withSuccessHandler(callback).submitHomeVisitForm(id, from);
  }
}
