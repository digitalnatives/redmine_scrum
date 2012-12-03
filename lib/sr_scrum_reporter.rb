module SR
  class ScrumReporter
    attr_reader :issues, :days, :criteria, :columns, :from, :to, :hours, :total_hours, :periods

    def initialize(project, version)
      @project = project
      @version = version

      @criteria = criteria || %w(version status issue member)
      @criteria = @criteria.select {|criteria| available_criteria.has_key? criteria }
      @criteria.uniq!
      @criteria = @criteria[0,5]

      @columns = 'day'
      @from = from
      @to = to

      run2
    end

    def available_criteria
      @available_criteria || load_available_criteria
    end

    private

    def run2
      default_conditions
      if @version
        @from = @version.try(:sprint_start_date) || @version.try(:created_on)
        @to = @version.effective_date
        #@issues = @issues.where(:time_entries => { :spent_on => @from..@to }) if @from && @to
        #@issues = @issues.where(:fixed_version_id => @version.id)
        if @from && @to
          @conditions += " AND time_entries.spent_on BETWEEN :from AND :to"
          @conditions += " AND issues.fixed_version_id = :version_id"
          @condition_vars.merge!({ 
            :from => @from,
            :to => @to,
            :version_id => @version.id 
          })
        end
      end

      @issues = Issue.all(:select => "issues.id, 
                           issues.parent_id,
                           issues.status_id, 
                           issues.subject, 
                           issues.remaining_hours, 
                           issues.estimated_hours, 
                           issues.assigned_to_id,
                           sum(time_entries.hours) AS spent_time,
                           min(time_entries.spent_on) AS first_time_entry,
                           max(time_entries.spent_on) AS last_time_entry",
                           :joins => "LEFT JOIN time_entries ON (time_entries.issue_id = issues.id)",
                           :include => [ :status, :assigned_to ],
                           :conditions => [ @conditions, @condition_vars ],
                           :group => 'issues.id',
                           :order => 'issues.parent_id DESC, issues.id ASC')

      unless @version 
         @from = @issues.map(&:first_time_entry).compact.min || Date.today
         @to = @issues.map(&:last_time_entry).compact.max || Date.today
       end

      @days = (@from..@to)
    end


    def default_conditions
      @conditions = "issues.project_id = :project_id 
                  AND issues.tracker_id = :tracker_id
                  AND issues.estimated_hours IS NOT NULL"
      @condition_vars = { 
        :project_id => @project.id,
        :tracker_id => RbTask.tracker
      }
    end

    def run
      unless @criteria.empty?
        scope = TimeEntry.visible.spent_between(@from, @to)
        if @version
          scope = scope.on_version(@version)
        elsif @project
          scope = scope.on_project(@project, Setting.display_subprojects_issues?)
        end
        time_columns = %w(tyear tmonth tweek spent_on te_remaining_hours)
        @hours = []
        scope.sum(:hours, :include => :issue, :group => @criteria.collect{|criteria| @available_criteria[criteria][:sql]} + time_columns).each do |hash, hours|
          h = {'hours' => hours}
          (@criteria + time_columns).each_with_index do |name, i|
            h[name] = hash[i]
          end
          @hours << h
        end

        @hours.each do |row|
          case @columns
          when 'year'
            row['year'] = row['tyear']
          when 'month'
            row['month'] = "#{row['tyear']}-#{row['tmonth']}"
          when 'week'
            row['week'] = "#{row['tyear']}-#{row['tweek']}"
          when 'day'
            row['day'] = "#{row['spent_on']}"
          end
        end

        if @from.nil?
          min = @hours.collect {|row| row['spent_on']}.min
          @from = min ? min.to_date : Date.today
        end

        if @to.nil?
          max = @hours.collect {|row| row['spent_on']}.max
          @to = max ? max.to_date : Date.today
        end

        @total_hours = @hours.inject(0) {|s,k| s = s + k['hours'].to_f}

        @periods = []
        # Date#at_beginning_of_ not supported in Rails 1.2.x
        date_from = @from.to_time
        # 100 columns max
        while date_from <= @to.to_time && @periods.length < 100
          case @columns
          when 'year'
            @periods << "#{date_from.year}"
            date_from = (date_from + 1.year).at_beginning_of_year
          when 'month'
            @periods << "#{date_from.year}-#{date_from.month}"
            date_from = (date_from + 1.month).at_beginning_of_month
          when 'week'
            @periods << "#{date_from.year}-#{date_from.to_date.cweek}"
            date_from = (date_from + 7.day).at_beginning_of_week
          when 'day'
            @periods << "#{date_from.to_date}"
            date_from = date_from + 1.day
          end
        end
      end
    end

    def load_available_criteria
      @available_criteria = { 'project' => {:sql => "#{TimeEntry.table_name}.project_id",
                                            :klass => Project,
                                            :label => :label_project},
                               'status' => {:sql => "#{Issue.table_name}.status_id",
                                            :klass => IssueStatus,
                                            :label => :field_status},
                               'version' => {:sql => "#{Issue.table_name}.fixed_version_id",
                                            :klass => Version,
                                            :label => :label_version},
                               'category' => {:sql => "#{Issue.table_name}.category_id",
                                              :klass => IssueCategory,
                                              :label => :field_category},
                               'member' => {:sql => "#{TimeEntry.table_name}.user_id",
                                           :klass => User,
                                           :label => :label_member},
                               'tracker' => {:sql => "#{Issue.table_name}.tracker_id",
                                            :klass => Tracker,
                                            :label => :label_tracker},
                               'activity' => {:sql => "#{TimeEntry.table_name}.activity_id",
                                             :klass => TimeEntryActivity,
                                             :label => :label_activity},
                               'issue' => {:sql => "#{TimeEntry.table_name}.issue_id",
                                           :klass => Issue,
                                           :label => :label_issue}
                             }

      # Add list and boolean custom fields as available criteria
      custom_fields = (@project.nil? ? IssueCustomField.for_all : @project.all_issue_custom_fields)
      custom_fields.select {|cf| %w(list bool).include? cf.field_format }.each do |cf|
        @available_criteria["cf_#{cf.id}"] = {:sql => "(SELECT c.value FROM #{CustomValue.table_name} c WHERE c.custom_field_id = #{cf.id} AND c.customized_type = 'Issue' AND c.customized_id = #{Issue.table_name}.id ORDER BY c.value LIMIT 1)",
                                               :format => cf.field_format,
                                               :label => cf.name}
      end if @project

      # Add list and boolean time entry custom fields
      TimeEntryCustomField.find(:all).select {|cf| %w(list bool).include? cf.field_format }.each do |cf|
        @available_criteria["cf_#{cf.id}"] = {:sql => "(SELECT c.value FROM #{CustomValue.table_name} c WHERE c.custom_field_id = #{cf.id} AND c.customized_type = 'TimeEntry' AND c.customized_id = #{TimeEntry.table_name}.id ORDER BY c.value LIMIT 1)",
                                               :format => cf.field_format,
                                               :label => cf.name}
      end

      # Add list and boolean time entry activity custom fields
      TimeEntryActivityCustomField.find(:all).select {|cf| %w(list bool).include? cf.field_format }.each do |cf|
        @available_criteria["cf_#{cf.id}"] = {:sql => "(SELECT c.value FROM #{CustomValue.table_name} c WHERE c.custom_field_id = #{cf.id} AND c.customized_type = 'Enumeration' AND c.customized_id = #{TimeEntry.table_name}.activity_id ORDER BY c.value LIMIT 1)",
                                               :format => cf.field_format,
                                               :label => cf.name}
      end

      @available_criteria
    end
  end
end
